"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import type { DictLookup } from "@/lib/types";
import { apiJson } from "@/lib/api";
import { StrokeButton } from "./StrokeButton";


type Props = {
  selection: { word: string; context: string } | null;
  onClose: () => void;
};

// Dictionary lookups are deterministic per word — cache them for the session.
const lookupCache = new Map<string, DictLookup>();

export function WordPanel({ selection, onClose }: Props) {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [data, setData] = useState<DictLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [graphed, setGraphed] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setData(null);
    setAdded("idle");
    setGraphed("idle");
    setError(null);
    if (!selection) return;
    const word = selection.word;
    const cached = lookupCache.get(word);
    if (cached) { setData(cached); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiJson<DictLookup>(`/api/dictionary/lookup?word=${encodeURIComponent(word)}`)
        .then((d) => { lookupCache.set(word, d); if (!cancelled) setData(d); })
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selection]);

  const playAudio = useCallback(() => {
    if (!data) return;
    // Prefer Google TTS for reliable Chinese pronunciation; browser TTS is a
    // silent fallback for environments that block the external request.
    if (audioRef.current) {
      audioRef.current.src = data.audio_url;
      audioRef.current.play().catch(() => {
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(data.word);
          u.lang = "zh-CN";
          u.rate = 0.85;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
      });
    }
  }, [data]);

  const onAddToBucket = useCallback(async () => {
    if (!data || !selection) return;
    setAdded("saving");
    try {
      await apiJson("/api/bucket", {
        method: "POST",
        json: {
          hanzi: data.word,
          pinyin: data.entries[0]?.pinyin ?? "",
          definition: (data.entries[0]?.definitions ?? []).join("; "),
          notes: selection.context || null,
        },
      });
      setAdded("ok");
    } catch { setAdded("err"); }
  }, [data, selection]);

  const onAddToGraph = useCallback(async () => {
    if (!selection) return;
    setGraphed("saving");
    try {
      await apiJson("/api/kg", {
        method: "POST",
        json: {
          hanzi: selection.word,
          pinyin: data?.entries[0]?.pinyin ?? "",
          definition: (data?.entries[0]?.definitions ?? []).join("; "),
          notes: selection.context || null,
        },
      });
      setGraphed("ok");
    } catch { setGraphed("err"); }
  }, [data, selection]);

  const examples = useMemo(() =>
    data?.entries.flatMap((e) =>
      e.definitions.filter((d) => /[。.!?!?]/.test(d) || /e\.g\./i.test(d)),
    ),
    [data],
  );

  if (!selection) {
    return (
      <div className="card text-sm text-ink/60">
        <div className="label mb-2">Word panel</div>
        Click a word in the smart reader to see its definition, pinyin, stroke order,
        and audio. You can also drag-select multi-character phrases.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="hanzi text-3xl font-bold leading-tight">
            {selection.word}
          </div>
          {data && (
            <button
              className="btn-outline shrink-0 px-2 py-1 text-sm"
              onClick={playAudio}
              aria-label="Play pronunciation"
            >
              🔊
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-ink/40 hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>

      {loading && <div className="text-sm text-ink/60">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <>
          <div>
            <div className="label mb-1">Definition</div>
            {data.entries.length === 0 ? (
              <div className="text-sm text-ink/60">No dictionary entry found.</div>
            ) : (
              <ul className="space-y-2">
                {data.entries.map((e, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-ink/70">{e.pinyin}</div>
                    <ol className="mt-1 list-decimal pl-5">
                      {e.definitions.map((d, j) => <li key={j}>{d}</li>)}
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
                {examples.slice(0, 4).map((ex, i) => <li key={i}>{ex}</li>)}
              </ul>
            </div>
          )}

          {data.characters.length > 0 && (
            <div>
              <div className="label mb-1">Stroke order</div>
              <div className="flex flex-wrap gap-3">
                {data.characters.map((ch) => (
                  ch.stroke_animated_svg ? (
                    <StrokeButton key={ch.char} url={ch.stroke_animated_svg} char={ch.char} />
                  ) : (
                    <div key={ch.char} className="flex items-center justify-center rounded-md border border-ink/10 p-2">
                      <div className="hanzi text-2xl">{ch.char}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {signedIn ? (
              <>
                <button
                  className="btn-outline"
                  onClick={onAddToBucket}
                  disabled={added === "saving" || added === "ok"}
                >
                  {added === "ok" ? "Added ✓" : added === "saving" ? "Saving…" : "Add to flashcards"}
                </button>
                <button
                  className="btn-outline"
                  onClick={onAddToGraph}
                  disabled={graphed === "saving" || graphed === "ok"}
                  title="Adds to your knowledge graph and links to related words"
                >
                  {graphed === "ok" ? "In knowledge graph ✓" : graphed === "saving" ? "Linking…" : graphed === "err" ? "Retry" : "+ Add to knowledge graph"}
                </button>
              </>
            ) : (
              <button
                className="btn-outline text-accent"
                onClick={() => signIn()}
              >
                Sign in to save →
              </button>
            )}
          </div>

          <audio ref={audioRef} className="hidden" />
        </>
      )}
    </div>
  );
}
