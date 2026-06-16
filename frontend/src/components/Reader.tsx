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
import { PageHeader } from "./PageHeader";
import { WordPanel } from "./WordPanel";
import { TokenGlossBadge, TranslationSentence } from "./ReaderTranslation";

type Token = ReaderReadResult["tokens"][number];

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

const SAMPLE = `今天天气真好，所以老师带学生去公园看花。
我最近在学习中文，每天都会读一些短文，遇到不认识的字就查一下。
学习语言是一件需要耐心的事，但是非常有意思。`;

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

  const containerRef = useRef<HTMLDivElement>(null);
  const tokens = readResult?.tokens ?? null;
  const sentences = readResult?.sentences ?? [];

  const sentenceGroups = useMemo(() => {
    if (!tokens) return [];
    return sentenceGroupsFromResult(tokens, sentences);
  }, [tokens, sentences]);

  useEffect(() => {
    if (initialText && initialText !== text) setText(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  const onRead = useCallback(async () => {
    setError(null);
    if (!text.trim()) return;
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
        const fallback = await fetch("/api/dictionary/segment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!fallback.ok) throw new Error(`HTTP ${res.status}`);
        const seg = (await fallback.json()) as { tokens: Token[] };
        setReadResult({ tokens: seg.tokens, sentences: [] });
        setError("Translation unavailable — showing segmentation only.");
        return;
      }
      setReadResult((await res.json()) as ReaderReadResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [text]);

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
      if (a?.gloss) return a.gloss;
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

    const onMouseEnter = () => setActiveLink({ sentenceIdx, tokenIndex: i });

    const sharedProps = {
      "data-active": active ? "true" : undefined,
      "data-link-hover": linked ? "true" : undefined,
      "data-filler": isFiller ? "true" : undefined,
      title: gloss,
      onClick: () => onTokenClick(tok),
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
      <PageHeader
        title="Smart Reader"
        subtitle="Paste Chinese text — segmentation, translation, hover links, and listen sentence-by-sentence."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="card space-y-3">
            <label className="label block">Paste Chinese text</label>
            <textarea
              className="textarea hanzi min-h-[140px] text-base"
              placeholder="把中文粘贴在这里…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={onRead} disabled={loading || !text.trim()}>
                {loading ? "Reading & translating…" : "Read"}
              </button>
              <button className="btn-outline" onClick={() => setText(SAMPLE)} type="button">
                Load sample
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setText("");
                  setReadResult(null);
                  setSelected(null);
                  setError(null);
                }}
              >
                Clear
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>

          {tokens && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPinyin}
                    onChange={(e) => setShowPinyin(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Show {preferences.audio === "cantonese" ? "jyutping" : "pinyin"}
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
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
                onMouseLeave={() => setActiveLink(null)}
              >
                {sentenceGroups.map((indices, sentenceIdx) => {
                  const translation = sentences[sentenceIdx];
                  const isPlaying = playingSentence === sentenceIdx;
                  const isActive =
                    activeLink?.sentenceIdx === sentenceIdx;

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
                        <button
                          type="button"
                          className="btn-outline shrink-0 px-2 py-1 text-sm"
                          onClick={() => playSentence(sentenceIdx, indices)}
                          aria-label={`Listen to sentence ${sentenceIdx + 1}`}
                          title={`Listen (${preferences.audio === "cantonese" ? "Cantonese" : "Mandarin"})`}
                        >
                          {isPlaying ? "🔊 …" : "🔊"}
                        </button>
                      </div>

                      {isActive && (
                        <TokenGlossBadge
                          sentences={sentences}
                          activeLink={activeLink}
                        />
                      )}

                      {showTranslation && translation && (
                        <TranslationSentence
                          sent={translation}
                          sentenceIdx={sentenceIdx}
                          activeLink={activeLink}
                          onActivateLink={setActiveLink}
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
            <div className="space-y-4">
              <div className="subtle-card text-sm text-ink/70">
                Paste any Chinese above and press <b>Read</b>. Each sentence has a{" "}
                <b>🔊</b> button to hear it aloud.
              </div>
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

        <div className="lg:sticky lg:top-[88px] lg:self-start">
          <WordPanel selection={selected} onClose={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}
