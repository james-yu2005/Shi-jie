"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DictLookup, ReaderReadResult } from "@/lib/types";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";
import {
  chineseForIndices,
  sentenceGroupsFromResult,
} from "@/lib/reader-sentences";
import {
  alignmentForToken,
  isTokenHighlighted,
  type ActiveLink,
} from "@/lib/reader-alignment";
import { countHanzi, TRANSLATE_HANZI_LIMIT } from "@/lib/chinese";
import { prefersFinePointer } from "@/lib/pointer";
import { resolveWordPanelGloss } from "@/lib/word-gloss";
import { markFirstWorldStep } from "@/lib/first-world";
import {
  addSavedSentence,
  findSavedSentence,
  loadReaderMemory,
  READER_MEMORY_LIMIT,
  removeSavedSentence,
  saveReaderMemory,
  sliceSentenceResult,
  type SavedReaderSentence,
} from "@/lib/reader-memory";
import {
  clearReaderSession,
  loadReaderSession,
  saveReaderSession,
} from "@/lib/reader-session";
import { PageHeader } from "./PageHeader";
import { MobileSheet } from "./MobileSheet";
import { SiteGuide } from "./SiteGuide";
import { WordPanel } from "./WordPanel";
import { TokenGlossBadge, TranslationSentence } from "./ReaderTranslation";

type Token = ReaderReadResult["tokens"][number];

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

const NEXT_STEPS = [
  { href: "/flashcards", title: "Flashcards", body: "Save words you didn't know and drill yourself." },
  { href: "/graph", title: "Knowledge Graph", body: "Watch your vocabulary cluster by radical and meaning." },
  { href: "/daily", title: "Daily Game", body: "Describe an image in Chinese. AI grades you and hints." },
];

function tokenRomanization(
  tok: Token,
  romanization: (entry: DictLookup["entries"][0]) => string,
): string {
  const e = tok.entries[0];
  if (!e) return "";
  return romanization(e);
}

function dictGloss(tok: Token): string | null {
  const d = tok.entries[0]?.definitions?.[0];
  if (!d) return null;
  return d.split(";")[0].split("(")[0].trim() || null;
}

export function Reader({ initialText }: { initialText?: string }) {
  const { displayHanzi, romanization, preferences, playAudio } = useLearningPreferences();
  const [text, setText] = useState(initialText ?? "");
  const [readResult, setReadResult] = useState<ReaderReadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ word: string; context: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPinyin, setShowPinyin] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [activeLink, setActiveLink] = useState<ActiveLink | null>(null);
  const [playingSentence, setPlayingSentence] = useState<number | null>(null);
  const [finePointer, setFinePointer] = useState(true);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [savedSentences, setSavedSentences] = useState<SavedReaderSentence[]>([]);
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const fromSampleRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tokens = readResult?.tokens ?? null;
  const sentences = readResult?.sentences ?? [];

  const sentenceGroups = useMemo(() => {
    if (!tokens) return [];
    return sentenceGroupsFromResult(tokens, sentences);
  }, [tokens, sentences]);

  const hanziCount = useMemo(() => countHanzi(text), [text]);
  const overLimit = hanziCount > TRANSLATE_HANZI_LIMIT;

  useEffect(() => {
    const session = loadReaderSession();
    setSavedSentences(loadReaderMemory());

    if (initialText) {
      setText(initialText);
      if (session?.text === initialText && session.readResult) {
        setReadResult(session.readResult);
        setShowPinyin(session.showPinyin);
        setShowTranslation(session.showTranslation);
      }
    } else if (session) {
      setText(session.text);
      setReadResult(session.readResult);
      setShowPinyin(session.showPinyin);
      setShowTranslation(session.showTranslation);
    }
    setSessionReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (initialText && initialText !== text) {
      setText(initialText);
      setReadResult(null);
      setSelected(null);
      setActiveLink(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    saveReaderSession({ text, readResult, showPinyin, showTranslation });
  }, [text, readResult, showPinyin, showTranslation, sessionReady]);

  useEffect(() => {
    setFinePointer(prefersFinePointer());
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setFinePointer(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (finePointer) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element;
      if (
        target.closest(
          ".hanzi-token, .english-token, [data-reader-gloss], [data-reader-word-panel], [role='dialog']",
        )
      ) {
        return;
      }
      setActiveLink(null);
      setSelected(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [finePointer]);

  const closeWordPanel = useCallback(() => {
    setSelected(null);
    setActiveLink(null);
  }, []);

  const generateSample = useCallback(async () => {
    setSampleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reader/sample");
      const body = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !body.text) {
        throw new Error(body.error ?? "Could not generate sample");
      }
      setText(body.text);
      fromSampleRef.current = true;
      setReadResult(null);
      setSelected(null);
      setActiveLink(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSampleLoading(false);
    }
  }, []);

  const onRead = useCallback(async () => {
    setError(null);
    if (!text.trim()) return;
    if (overLimit) {
      setError(
        `Keep it to ${TRANSLATE_HANZI_LIMIT} Chinese characters or fewer (you have ${hanziCount}).`,
      );
      return;
    }
    setLoading(true);
    setActiveLink(null);
    setPlayingSentence(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? `Maximum ${TRANSLATE_HANZI_LIMIT} Chinese characters`);
          return;
        }
        const fallback = await fetch("/api/dictionary/segment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!fallback.ok) throw new Error(`HTTP ${res.status}`);
        const seg = (await fallback.json()) as { tokens: Token[] };
        setReadResult({ tokens: seg.tokens, sentences: [] });
        setError("Translation unavailable — showing segmentation only.");
        if (fromSampleRef.current) {
          markFirstWorldStep("sample");
          fromSampleRef.current = false;
        }
        return;
      }
      setReadResult((await res.json()) as ReaderReadResult);
      if (fromSampleRef.current) {
        markFirstWorldStep("sample");
        fromSampleRef.current = false;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [text, hanziCount, overLimit]);

  const sentenceTexts = useMemo(() => {
    if (!tokens) return [] as string[];
    return sentenceGroups.map((indices) =>
      chineseForIndices(tokens, indices, (t) => t),
    );
  }, [tokens, sentenceGroups]);

  function contextFor(word: string): string {
    for (const s of sentenceTexts) {
      if (s.includes(word)) return s.trim();
    }
    return "";
  }

  function handleTokenActivate(tok: Token, sentenceIdx: number, tokenIndex: number) {
    const link = { sentenceIdx, tokenIndex };
    if (finePointer) {
      onTokenClick(tok);
      setActiveLink(link);
      return;
    }
    const same =
      activeLink?.sentenceIdx === sentenceIdx && activeLink?.tokenIndex === tokenIndex;
    if (same) {
      setActiveLink(null);
      setSelected(null);
    } else {
      setActiveLink(link);
      setSelected(null);
    }
  }

  function handleLookUpActiveToken() {
    if (!activeLink || !tokens) return;
    const tok = tokens[activeLink.tokenIndex];
    if (tok?.is_hanzi) onTokenClick(tok);
  }

  function onTokenClick(token: Token) {
    if (!token.is_hanzi) return;
    setSelected({ word: token.token, context: contextFor(token.token) });
  }

  function onMouseUp() {
    const sel = window.getSelection?.();
    const t = sel?.toString().trim();
    if (!t || !HAN.test(t)) return;
    setSelected({ word: t, context: contextFor(t) });
  }

  function tokenGloss(sentenceIdx: number, tokenIdx: number, tok: Token): string {
    const sent = sentences[sentenceIdx];
    if (sent) {
      const a = alignmentForToken(sent.alignments, tokenIdx);
      if (a?.gloss) {
        if (a.is_filler || tok.entries.length === 0) return a.gloss;
        return resolveWordPanelGloss(tok, a.gloss);
      }
    }
    return dictGloss(tok) ?? tokenRomanization(tok, romanization);
  }

  function tokenIsFiller(sentenceIdx: number, tokenIdx: number): boolean {
    const sent = sentences[sentenceIdx];
    if (!sent) return false;
    return alignmentForToken(sent.alignments, tokenIdx)?.is_filler ?? false;
  }

  const playSentence = useCallback(
    (sentenceIdx: number, indices: number[]) => {
      if (!tokens) return;
      const chinese = chineseForIndices(tokens, indices, displayHanzi);
      if (!chinese.trim()) return;
      setPlayingSentence(sentenceIdx);
      playAudio(chinese);
      window.setTimeout(() => setPlayingSentence(null), 4000);
    },
    [tokens, displayHanzi, playAudio],
  );

  const saveSentence = useCallback(
    (sentenceIdx: number, indices: number[]) => {
      if (!readResult || !tokens) return;
      const chinese = chineseForIndices(tokens, indices, (t) => t).trim();
      if (!chinese) return;
      const english = (sentences[sentenceIdx]?.english ?? "").trim();
      const sliced = sliceSentenceResult(readResult, sentenceIdx, indices);
      if (!sliced) return;

      const result = addSavedSentence(savedSentences, {
        chinese,
        english,
        readResult: sliced,
      });
      if (!result.ok) {
        setMemoryNotice(
          result.reason === "full"
            ? `Memory is full (${READER_MEMORY_LIMIT}/5). Remove one to save another.`
            : "Already saved.",
        );
        return;
      }
      setSavedSentences(result.items);
      saveReaderMemory(result.items);
      setMemoryNotice("Sentence saved.");
    },
    [readResult, tokens, sentences, savedSentences],
  );

  const loadSavedSentence = useCallback((item: SavedReaderSentence) => {
    setText(item.chinese);
    setReadResult(item.readResult);
    setSelected(null);
    setActiveLink(null);
    setError(null);
    setPlayingSentence(null);
    setMemoryNotice(null);
    fromSampleRef.current = false;
  }, []);

  const deleteSavedSentence = useCallback(
    (id: string) => {
      const next = removeSavedSentence(savedSentences, id);
      setSavedSentences(next);
      saveReaderMemory(next);
      setMemoryNotice(null);
    },
    [savedSentences],
  );

  function renderToken(tok: Token, i: number, sentenceIdx: number) {
    if (!tok.is_hanzi) {
      if (tok.token === "\n") return <br key={i} />;
      return <span key={i}>{tok.token}</span>;
    }
    const active = selected?.word === tok.token;
    const displayed = displayHanzi(tok.token);
    const py = showPinyin ? tokenRomanization(tok, romanization) : "";
    const gloss = tokenGloss(sentenceIdx, i, tok);
    const isFiller = tokenIsFiller(sentenceIdx, i);
    const linked = isTokenHighlighted(
      sentences[sentenceIdx]?.alignments ?? [],
      i,
      activeLink,
      sentenceIdx,
    );

    const onMouseEnter = finePointer
      ? () => setActiveLink({ sentenceIdx, tokenIndex: i })
      : undefined;

    const sharedProps = {
      "data-active": active ? "true" : undefined,
      "data-link-hover": linked ? "true" : undefined,
      "data-filler": isFiller ? "true" : undefined,
      title: gloss,
      onClick: () => handleTokenActivate(tok, sentenceIdx, i),
      onMouseEnter,
    };

    if (showPinyin && py) {
      return (
        <ruby key={i} className="hanzi-token" {...sharedProps}>
          {displayed}
          <rt className="text-[0.55em] text-ink/60">{py}</rt>
        </ruby>
      );
    }

    return (
      <span key={i} className="hanzi-token" {...sharedProps}>
        {displayed}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <SiteGuide />

      <PageHeader
        title="Smart Reader"
        subtitle={
          finePointer
            ? `Paste up to ${TRANSLATE_HANZI_LIMIT} Chinese characters — segmentation, translation, hover links, and listen sentence-by-sentence.`
            : `Paste up to ${TRANSLATE_HANZI_LIMIT} Chinese characters — tap a word to see its English match; tap Look up for the dictionary.`
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="label">Paste Chinese text</label>
              <span
                className={`text-xs tabular-nums ${overLimit ? "font-medium text-red-600" : "text-ink/50"}`}
              >
                {hanziCount} / {TRANSLATE_HANZI_LIMIT}
              </span>
            </div>
            <textarea
              className="textarea hanzi min-h-[140px] text-base"
              placeholder="把中文粘贴在这里…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                className="btn-primary w-full sm:w-auto"
                onClick={onRead}
                disabled={loading || !text.trim() || overLimit}
              >
                {loading ? "Reading & translating…" : "Read"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-outline"
                  onClick={generateSample}
                  disabled={sampleLoading}
                  type="button"
                >
                  {sampleLoading ? "Generating…" : "Generate sample"}
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setText("");
                    setReadResult(null);
                    setSelected(null);
                    setError(null);
                    setActiveLink(null);
                    setMemoryNotice(null);
                    clearReaderSession();
                  }}
                >
                  Clear
                </button>
              </div>
              {error && <span className="w-full text-sm text-red-600">{error}</span>}
              {memoryNotice && (
                <span className="w-full text-sm text-ink/60">{memoryNotice}</span>
              )}
            </div>
          </div>

          {savedSentences.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">Saved translations</h2>
                <span className="text-xs tabular-nums text-ink/50">
                  {savedSentences.length} / {READER_MEMORY_LIMIT}
                </span>
              </div>
              <ul className="space-y-2">
                {savedSentences.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 border-t border-ink/10 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="hanzi text-sm leading-relaxed">{item.chinese}</p>
                      {item.english && (
                        <p className="text-sm text-ink/65">{item.english}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => loadSavedSentence(item)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => deleteSavedSentence(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tokens && (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                <label className="tap-label">
                  <input
                    type="checkbox"
                    checked={showPinyin}
                    onChange={(e) => setShowPinyin(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Show {preferences.audio === "cantonese" ? "jyutping" : "pinyin"}
                </label>
                <label className="tap-label">
                  <input
                    type="checkbox"
                    checked={showTranslation}
                    onChange={(e) => setShowTranslation(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Show English translation
                </label>
              </div>

              <div
                ref={containerRef}
                className="space-y-3"
                onMouseUp={onMouseUp}
                onMouseLeave={finePointer ? () => setActiveLink(null) : undefined}
              >
                {sentenceGroups.map((indices, sentenceIdx) => {
                  const translation = sentences[sentenceIdx];
                  const isPlaying = playingSentence === sentenceIdx;
                  const isActive =
                    activeLink?.sentenceIdx === sentenceIdx;
                  const chineseRaw = chineseForIndices(tokens, indices, (t) => t).trim();
                  const englishRaw = (translation?.english ?? "").trim();
                  const alreadySaved = Boolean(
                    findSavedSentence(savedSentences, chineseRaw, englishRaw),
                  );

                  return (
                    <div
                      key={sentenceIdx}
                      className="card space-y-2"
                      data-sentence-playing={isPlaying ? "true" : undefined}
                    >
                      <div className="flex items-start gap-2">
                        <div className="hanzi min-w-0 flex-1 text-base leading-loose">
                          {indices.map((i) => renderToken(tokens[i], i, sentenceIdx))}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => playSentence(sentenceIdx, indices)}
                            aria-label={`Listen to sentence ${sentenceIdx + 1}`}
                            title={`Listen (${preferences.audio === "cantonese" ? "Cantonese" : "Mandarin"})`}
                          >
                            {isPlaying ? "🔊 …" : "🔊"}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            onClick={() => saveSentence(sentenceIdx, indices)}
                            disabled={alreadySaved}
                            title={
                              alreadySaved
                                ? "Already saved"
                                : savedSentences.length >= READER_MEMORY_LIMIT
                                  ? `Memory full (${READER_MEMORY_LIMIT}/5)`
                                  : "Save this translation"
                            }
                          >
                            {alreadySaved ? "Saved" : "Save"}
                          </button>
                        </div>
                      </div>

                      {isActive && (
                        <div data-reader-gloss>
                          <TokenGlossBadge
                            sentences={sentences}
                            tokens={tokens}
                            activeLink={activeLink}
                            showLookUp={!finePointer}
                            onLookUp={handleLookUpActiveToken}
                          />
                        </div>
                      )}

                      {showTranslation && translation && (
                        <TranslationSentence
                          sent={translation}
                          sentenceIdx={sentenceIdx}
                          activeLink={activeLink}
                          onActivateLink={setActiveLink}
                          useHoverLink={finePointer}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {showTranslation && sentences.length === 0 && (
                <div className="subtle-card text-sm text-ink/60">
                  No translation returned. Check that the backend is running with an OpenAI key.
                </div>
              )}
            </>
          )}

          {!tokens && (
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {NEXT_STEPS.map((s) => (
                  <Link key={s.href} href={s.href} className="card group transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="font-semibold group-hover:text-accent">{s.title} →</div>
                    <p className="mt-1 text-sm text-ink/70">{s.body}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-[var(--header-offset)] lg:self-start">
          <WordPanel selection={selected} onClose={() => setSelected(null)} />
        </div>
      </div>

      <MobileSheet
        open={Boolean(selected)}
        onClose={closeWordPanel}
        label="Word panel"
        compact
      >
        <WordPanel
          selection={selected}
          onClose={closeWordPanel}
          className="!border-0 !p-0 !shadow-none"
        />
      </MobileSheet>
    </div>
  );
}
