"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Flashcard } from "@/lib/types";
import { BucketEditor } from "./BucketEditor";
import { TypingGame } from "./TypingGame";

type Mode = "manage" | "typing" | "paragraph";

export function FlashcardsClient({
  initialCards,
}: {
  initialCards: Flashcard[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [mode, setMode] = useState<Mode>("manage");
  const [paragraph, setParagraph] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/bucket");
    if (r.ok) {
      const j = await r.json();
      setCards(j.flashcards as Flashcard[]);
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      const r = await fetch(`/api/bucket/${id}`, { method: "DELETE" });
      if (r.ok) setCards((cs) => cs.filter((c) => c.id !== id));
    },
    [],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Flashcard>) => {
      const r = await fetch(`/api/bucket/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        const j = await r.json();
        setCards((cs) => cs.map((c) => (c.id === id ? j.flashcard : c)));
      }
    },
    [],
  );

  const add = useCallback(
    async (hanzi: string, pinyin: string, definition: string) => {
      const r = await fetch("/api/bucket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hanzi, pinyin, definition }),
      });
      if (r.ok) await refresh();
    },
    [refresh],
  );

  const generateParagraph = useCallback(async () => {
    setError(null);
    setGenLoading(true);
    try {
      const r = await fetch("/api/ai/paragraph", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ words: cards.map((c) => c.hanzi) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setParagraph(j.paragraph as string);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenLoading(false);
    }
  }, [cards]);

  const sendToReader = useCallback(() => {
    if (!paragraph) return;
    router.push(`/?text=${encodeURIComponent(paragraph)}`);
  }, [paragraph, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <span className="text-ink/60">·</span>
        <span className="text-ink/70">{cards.length} word{cards.length === 1 ? "" : "s"} in your bucket</span>
        <div className="ml-auto flex gap-2">
          <button
            className={mode === "manage" ? "btn-primary" : "btn-outline"}
            onClick={() => setMode("manage")}
          >
            Manage bucket
          </button>
          <button
            className={mode === "typing" ? "btn-primary" : "btn-outline"}
            onClick={() => setMode("typing")}
            disabled={cards.length === 0}
          >
            Typing test
          </button>
          <button
            className={mode === "paragraph" ? "btn-primary" : "btn-outline"}
            onClick={() => setMode("paragraph")}
            disabled={cards.length === 0}
          >
            AI paragraph
          </button>
        </div>
      </div>

      {mode === "manage" && (
        <BucketEditor
          cards={cards}
          onAdd={add}
          onRemove={remove}
          onUpdate={update}
        />
      )}

      {mode === "typing" && cards.length > 0 && <TypingGame cards={cards} />}

      {mode === "paragraph" && (
        <div className="card space-y-4">
          <p className="text-sm text-ink/70">
            Generates a short Chinese paragraph using <b>every word</b> in your
            bucket. Send it to the Reader to study it the same way you study
            anything else.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={generateParagraph}
              disabled={genLoading || cards.length === 0}
            >
              {genLoading ? "Generating…" : "Generate paragraph"}
            </button>
            {paragraph && (
              <button className="btn-accent" onClick={sendToReader}>
                Open in Reader →
              </button>
            )}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {paragraph && (
            <div className="hanzi rounded-md border border-ink/10 bg-paper p-4 text-base leading-loose">
              {paragraph}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
