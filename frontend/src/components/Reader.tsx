"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DictLookup } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { WordPanel } from "./WordPanel";

type Token = {
  token: string;
  is_hanzi: boolean;
  entries: DictLookup["entries"];
};

type Segmented = { tokens: Token[] };

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

const SAMPLE = `今天天气真好，我们一起去公园散步吧。
我最近在学习中文，每天都会读一些短文，遇到不认识的字就查一下。
学习语言是一件需要耐心的事，但是非常有意思。`;

const NEXT_STEPS = [
  { href: "/flashcards", title: "Flashcards", body: "Save words you didn't know and drill yourself." },
  { href: "/graph", title: "Knowledge graph", body: "Watch your vocabulary cluster by radical and meaning." },
  { href: "/daily", title: "Daily image", body: "Describe an image in Chinese. AI grades you and hints." },
];

// Tone colours used when toneColors toggle is on.
const TONE_COLOR: Record<number, string> = {
  1: "#c0392b",   // red — flat
  2: "#d97706",   // amber — rising
  3: "#16a34a",   // green — dip-and-rise
  4: "#2563eb",   // blue — falling
  0: "inherit",   // neutral / unknown
};

/** Extract the dominant (first) tone number from a numbered-pinyin string like "gao1xing4". */
function dominantTone(pinyinNumbered: string): number {
  const m = pinyinNumbered.match(/[1-4]/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Return the display pinyin from a token's first entry (prefer tone-mark form). */
function displayPinyin(tok: Token): string {
  const e = tok.entries[0];
  if (!e) return "";
  return e.pinyin || e.pinyin_numbered || "";
}

export function Reader({ initialText }: { initialText?: string }) {
  const [text, setText] = useState(initialText ?? "");
  const [segmented, setSegmented] = useState<Segmented | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ word: string; context: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Display toggles
  const [showPinyin, setShowPinyin] = useState(false);
  const [toneColors, setToneColors] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialText && initialText !== text) setText(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  const onRead = useCallback(async () => {
    setError(null);
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/dictionary/segment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSegmented((await res.json()) as Segmented);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [text]);

  const sentences = useMemo(() => {
    if (!segmented) return [] as string[];
    const joined = segmented.tokens.map((t) => t.token).join("");
    return joined.split(/(?<=[。！？!?\n])/).filter((s) => s.trim());
  }, [segmented]);

  function contextFor(word: string): string {
    for (const s of sentences) { if (s.includes(word)) return s.trim(); }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reader"
        subtitle="Paste any Chinese text. Click a word to see its definition, pinyin, stroke order, and audio — or drag-select multi-character phrases."
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
                {loading ? "Reading…" : "Read"}
              </button>
              <button className="btn-outline" onClick={() => setText(SAMPLE)} type="button">
                Load sample
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => { setText(""); setSegmented(null); setSelected(null); }}
              >
                Clear
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>

          {segmented && (
            <>
              {/* Display-mode toggles */}
              <div className="flex items-center gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPinyin}
                    onChange={(e) => setShowPinyin(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Show pinyin
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={toneColors}
                    onChange={(e) => setToneColors(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Tone colours
                </label>
              </div>

              <div ref={containerRef} className="card hanzi" onMouseUp={onMouseUp}>
                {segmented.tokens.map((tok, i) => {
                  if (!tok.is_hanzi) {
                    if (tok.token === "\n") return <br key={i} />;
                    return <span key={i}>{tok.token}</span>;
                  }
                  const active = selected?.word === tok.token;
                  const tone = toneColors ? dominantTone(tok.entries[0]?.pinyin_numbered ?? "") : 0;
                  const py = showPinyin ? displayPinyin(tok) : "";

                  if (showPinyin && py) {
                    return (
                      <ruby
                        key={i}
                        className="hanzi-token"
                        data-active={active ? "true" : undefined}
                        onClick={() => onTokenClick(tok)}
                        style={{ color: toneColors ? TONE_COLOR[tone] : undefined }}
                      >
                        {tok.token}
                        <rt className="text-[0.55em] text-ink/60">{py}</rt>
                      </ruby>
                    );
                  }

                  return (
                    <span
                      key={i}
                      className="hanzi-token"
                      data-active={active ? "true" : undefined}
                      onClick={() => onTokenClick(tok)}
                      title={tok.entries[0]?.pinyin || tok.entries[0]?.pinyin_numbered || ""}
                      style={{ color: toneColors ? TONE_COLOR[tone] : undefined }}
                    >
                      {tok.token}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          {!segmented && (
            <div className="space-y-4">
              <div className="subtle-card text-sm text-ink/70">
                Paste any Chinese above and press <b>Read</b>. Then click any
                highlighted word — or drag-select a few characters — to see
                its definition, pinyin, stroke order, audio, and saving actions.
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
