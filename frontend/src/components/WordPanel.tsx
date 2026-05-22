"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DictLookup } from "@/lib/types";

type Props = {
  selection: { word: string; context: string } | null;
  onClose: () => void;
};

export function WordPanel({ selection, onClose }: Props) {
  const [data, setData] = useState<DictLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMd, setAiMd] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [added, setAdded] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setData(null);
    setAiMd(null);
    setAdded("idle");
    setError(null);
    if (!selection) return;
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/dictionary/lookup?word=${encodeURIComponent(selection.word)}&context=${encodeURIComponent(selection.context)}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DictLookup;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const playAudio = useCallback(() => {
    if (!data) return;
    // Try browser TTS first (works offline / cleaner voice)
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(data.word);
      u.lang = "zh-CN";
      u.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return;
    }
    // fallback: Google TTS audio URL
    if (audioRef.current) {
      audioRef.current.src = data.audio_url;
      audioRef.current.play().catch(() => {});
    }
  }, [data]);

  const onAddToBucket = useCallback(async () => {
    if (!data || !selection) return;
    setAdded("saving");
    const e0 = data.entries[0];
    const res = await fetch("/api/bucket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hanzi: data.word,
        pinyin: e0?.pinyin ?? "",
        definition: (e0?.definitions ?? []).join("; "),
        notes: selection.context || null,
      }),
    });
    setAdded(res.ok ? "ok" : "err");
  }, [data, selection]);

  const onAskAI = useCallback(async () => {
    if (!selection) return;
    setAiLoading(true);
    setAiMd(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          word: selection.word,
          context: selection.context,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setAiMd(json.markdown as string);
    } catch (e) {
      setAiMd(`*Error:* ${String(e)}`);
    } finally {
      setAiLoading(false);
    }
  }, [selection]);

  const examples = useMemo(() => {
    // Heuristic: pull short example-y definitions from the entries (CC-CEDICT
    // often includes example sentences in parens; we just show the raw list).
    return data?.entries.flatMap((e) =>
      e.definitions.filter((d) => /[。.!?！？]/.test(d) || /e\.g\./i.test(d)),
    );
  }, [data]);

  if (!selection) {
    return (
      <div className="card text-sm text-ink/60">
        <div className="label mb-2">Word panel</div>
        Click a word in the reader to see its definition, pinyin, stroke order,
        and audio. You can also drag-select multi-character phrases.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="hanzi text-3xl font-bold leading-tight">
            {selection.word}
          </div>
          {data && data.entries[0] && (
            <div className="text-sm text-ink/70">{data.entries[0].pinyin}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-ink/40 hover:text-ink"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {loading && <div className="text-sm text-ink/60">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <>
          <div>
            <div className="label mb-1">Definition</div>
            {data.entries.length === 0 ? (
              <div className="text-sm text-ink/60">
                No dictionary entry found. Try the AI explanation below.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.entries.map((e, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-ink/70">{e.pinyin}</div>
                    <ol className="mt-1 list-decimal pl-5">
                      {e.definitions.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {examples && examples.length > 0 && (
            <div>
              <div className="label mb-1">Examples</div>
              <ul className="list-disc pl-5 text-sm text-ink/80">
                {examples.slice(0, 4).map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </div>
          )}

          {data.characters.length > 0 && (
            <div>
              <div className="label mb-1">Stroke order</div>
              <div className="flex flex-wrap gap-3">
                {data.characters.map((ch) => (
                  <div
                    key={ch.char}
                    className="flex flex-col items-center rounded-md border border-ink/10 p-2"
                  >
                    {ch.stroke_animated_svg ? (
                      // The makemeahanzi SVG draws strokes via CSS animation.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ch.stroke_animated_svg}
                        alt={`stroke order for ${ch.char}`}
                        width={64}
                        height={64}
                      />
                    ) : (
                      <div className="hanzi text-2xl">{ch.char}</div>
                    )}
                    <span className="hanzi mt-1 text-xs">{ch.char}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={playAudio}>
              🔊 Play
            </button>
            <button
              className="btn-outline"
              onClick={onAskAI}
              disabled={aiLoading}
            >
              {aiLoading ? "Thinking…" : "Ask AI"}
            </button>
            <button
              className="btn-accent"
              onClick={onAddToBucket}
              disabled={added === "saving" || added === "ok"}
            >
              {added === "ok"
                ? "Added ✓"
                : added === "saving"
                  ? "Saving…"
                  : "Add to bucket"}
            </button>
            <audio ref={audioRef} className="hidden" />
          </div>

          {aiMd && (
            <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm">
              <div className="label mb-1">AI explanation</div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {aiMd}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
