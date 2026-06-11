"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import type { DictLookup } from "@/lib/types";
import { apiJson } from "@/lib/api";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";
import { pickEntryForm } from "@/lib/script";
import { strokeAnimatedUrl } from "@/lib/strokes";
import { jyutpingFromEntry, pinyinFromEntry } from "@/lib/word-display";
import { StrokeButton } from "./StrokeButton";
import { WordHead } from "./WordHead";

type Props = {
  selection: { word: string; context: string } | null;
  onClose: () => void;
};

const lookupCache = new Map<string, DictLookup>();

function cacheKey(word: string, audio: string) {
  return `${word}:${audio}`;
}

export function WordPanel({ selection, onClose }: Props) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const { preferences, displayHanzi } = useLearningPreferences();

  const [data, setData] = useState<DictLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [graphed, setGraphed] = useState<"idle" | "saving" | "ok" | "err">("idle");

  useEffect(() => {
    setData(null);
    setAdded("idle");
    setGraphed("idle");
    setError(null);
    if (!selection) return;
    const word = selection.word;
    const key = cacheKey(word, preferences.audio);
    const cached = lookupCache.get(key);
    if (cached) { setData(cached); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiJson<DictLookup>(
        `/api/dictionary/lookup?word=${encodeURIComponent(word)}&audio=${preferences.audio}`,
      )
        .then((d) => { lookupCache.set(key, d); if (!cancelled) setData(d); })
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selection, preferences.audio]);

  const primaryEntry = data?.entries[0];

  const onAddToBucket = useCallback(async () => {
    if (!data || !selection || !primaryEntry) return;
    setAdded("saving");
    try {
      await apiJson("/api/bucket", {
        method: "POST",
        json: {
          hanzi: pickEntryForm(primaryEntry, preferences.script),
          pinyin: pinyinFromEntry(primaryEntry),
          jyutping: jyutpingFromEntry(primaryEntry),
          definition: (primaryEntry.definitions ?? []).join("; "),
          notes: selection.context || null,
        },
      });
      setAdded("ok");
    } catch { setAdded("err"); }
  }, [data, selection, primaryEntry, preferences.script]);

  const onAddToGraph = useCallback(async () => {
    if (!selection || !primaryEntry) return;
    setGraphed("saving");
    try {
      await apiJson("/api/kg", {
        method: "POST",
        json: {
          hanzi: pickEntryForm(primaryEntry, preferences.script),
          pinyin: pinyinFromEntry(primaryEntry),
          jyutping: jyutpingFromEntry(primaryEntry),
          definition: (primaryEntry.definitions ?? []).join("; "),
          notes: selection.context || null,
        },
      });
      setGraphed("ok");
    } catch { setGraphed("err"); }
  }, [selection, primaryEntry, preferences.script]);

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
        Click a word in the smart reader to see its definition, romanization, stroke order,
        and audio. You can also drag-select multi-character phrases.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <WordHead
          hanzi={selection.word}
          entry={primaryEntry}
          showAudio={Boolean(data)}
        />
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
                    <ol className="list-decimal pl-5">
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
                {data.characters.map((ch) => {
                  const strokeChar = displayHanzi(ch.char);
                  const strokeUrl = strokeAnimatedUrl(strokeChar);
                  return strokeUrl ? (
                    <StrokeButton
                      key={`${preferences.script}-${strokeChar}-${strokeUrl}`}
                      url={strokeUrl}
                      char={strokeChar}
                    />
                  ) : (
                    <div key={ch.char} className="flex items-center justify-center rounded-md border border-ink/10 p-2">
                      <div className="hanzi text-2xl">{strokeChar}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {signedIn ? (
              <>
                <button
                  className="btn-outline"
                  onClick={onAddToBucket}
                  disabled={added === "saving" || added === "ok"}
                >
                  {added === "ok" ? "Added ✓" : added === "saving" ? "Saving…" : "+ Add to flashcards"}
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
        </>
      )}
    </div>
  );
}
