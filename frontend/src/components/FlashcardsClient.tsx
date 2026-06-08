"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { Flashcard } from "@/lib/types";
import { apiJson, swrFetcher } from "@/lib/api";
import { AI_SENTENCE_MAX_WORDS } from "@/lib/hsk";
import { BucketEditor } from "./BucketEditor";
import { ModeTabs } from "./ModeTabs";
import { PageHeader } from "./PageHeader";
import { ReviewMode } from "./ReviewMode";

type Mode = "manage" | "review" | "sentence";

export function FlashcardsClient({ initialCards }: { initialCards: Flashcard[] }) {
  const router = useRouter();
  const { data, mutate } = useSWR<{ flashcards: Flashcard[] }>(
    "/api/bucket",
    swrFetcher,
    { fallbackData: { flashcards: initialCards }, revalidateOnFocus: false },
  );
  const cards = data?.flashcards ?? initialCards;
  const [mode, setMode] = useState<Mode>("manage");
  const [paragraph, setParagraph] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterLoading, setStarterLoading] = useState(false);
  const [starterMsg, setStarterMsg] = useState<string | null>(null);

  const setCards = useCallback(
    (updater: (cs: Flashcard[]) => Flashcard[]) =>
      mutate(
        (prev) => ({ flashcards: updater(prev?.flashcards ?? []) }),
        { revalidate: false },
      ),
    [mutate],
  );

  const remove = useCallback(async (id: string) => {
    try {
      await apiJson(`/api/bucket/${id}`, { method: "DELETE" });
      void setCards((cs) => cs.filter((c) => c.id !== id));
    } catch { /* leave list untouched */ }
  }, [setCards]);

  const update = useCallback(async (id: string, patch: Partial<Flashcard>) => {
    try {
      const j = await apiJson<{ flashcard: Flashcard }>(`/api/bucket/${id}`, {
        method: "PATCH",
        json: patch,
      });
      void setCards((cs) => cs.map((c) => (c.id === id ? j.flashcard : c)));
    } catch { /* ignore */ }
  }, [setCards]);

  const add = useCallback(async (hanzi: string, pinyin: string, definition: string) => {
    try {
      const j = await apiJson<{ flashcard: Flashcard }>("/api/bucket", {
        method: "POST",
        json: { hanzi, pinyin, definition },
      });
      void setCards((cs) => {
        const exists = cs.some((c) => c.id === j.flashcard.id);
        return exists ? cs.map((c) => (c.id === j.flashcard.id ? j.flashcard : c)) : [j.flashcard, ...cs];
      });
    } catch { /* ignore */ }
  }, [setCards]);

  const loadStarterDeck = useCallback(async () => {
    setStarterLoading(true);
    setStarterMsg(null);
    try {
      const j = await apiJson<{ added: number }>("/api/bucket/starter", { method: "POST" });
      setStarterMsg(j.added > 0 ? `Added ${j.added} new words!` : "All starter words already in bucket.");
      void mutate(); // refresh list from server
    } catch (e) {
      setStarterMsg(`Error: ${String(e)}`);
    } finally {
      setStarterLoading(false);
    }
  }, [mutate]);

  const overSentenceLimit = cards.length > AI_SENTENCE_MAX_WORDS;

  const generateParagraph = useCallback(async () => {
    setError(null);
    if (overSentenceLimit) {
      const excess = cards.length - AI_SENTENCE_MAX_WORDS;
      setError(
        `AI sentence supports up to ${AI_SENTENCE_MAX_WORDS} words. You have ${cards.length} — remove ${excess} from your bucket and try again.`,
      );
      return;
    }
    setGenLoading(true);
    try {
      const j = await apiJson<{ paragraph: string }>("/api/ai/paragraph", {
        method: "POST",
        json: { words: cards.map((c) => c.hanzi) },
      });
      setParagraph(j.paragraph);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  }, [cards, overSentenceLimit]);

  const sendToReader = useCallback(() => {
    if (!paragraph) return;
    router.push(`/?text=${encodeURIComponent(paragraph)}`);
  }, [paragraph, router]);

  // Count cards due for review (dueAt <= now or null)
  const dueCount = cards.filter((c) => !c.dueAt || new Date(c.dueAt) <= new Date()).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flashcards"
        subtitle="Save words you want to remember and test yourself, or generate an AI sentence for reading practice."
        meta={
          <>
            {cards.length} word{cards.length === 1 ? "" : "s"} in your bucket
            {dueCount > 0 && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                {dueCount} due
              </span>
            )}
          </>
        }
        actions={
          <ModeTabs<Mode>
            active={mode}
            onChange={setMode}
            tabs={[
              { id: "manage", label: "Manage" },
              { id: "review", label: `Review${dueCount > 0 ? ` (${dueCount})` : ""}` },
              { id: "sentence", label: "AI sentence", disabled: cards.length === 0 },
            ]}
          />
        }
      />

      {mode === "manage" && (
        <>
          <BucketEditor cards={cards} onAdd={add} onRemove={remove} onUpdate={update} />
          {/* Starter deck — visible when bucket is small */}
          {cards.length < 10 && (
            <div className="subtle-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">New here?</div>
                <p className="text-xs text-ink/60">Load 50 essential HSK 1–2 words to get started instantly.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="btn-outline"
                  onClick={loadStarterDeck}
                  disabled={starterLoading}
                >
                  {starterLoading ? "Loading…" : "Load starter deck (50 words)"}
                </button>
                {starterMsg && (
                  <span className="text-xs text-ink/60">{starterMsg}</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "review" && (
        <ReviewMode onDone={() => setMode("manage")} />
      )}

      {mode === "sentence" && (
        <div className="card space-y-4">
          <p className="text-sm text-ink/70">
            Generates a short Chinese sentence using <b>every word</b> in your
            bucket (up to {AI_SENTENCE_MAX_WORDS}). Open it in the Smart Reader and study it
            the same way you study anything else.
          </p>
          {overSentenceLimit && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              You have <b>{cards.length}</b> words — the limit is <b>{AI_SENTENCE_MAX_WORDS}</b>.
              Remove <b>{cards.length - AI_SENTENCE_MAX_WORDS}</b> from your bucket in Manage
              before generating a sentence.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={generateParagraph}
              disabled={genLoading || cards.length === 0 || overSentenceLimit}
            >
              {genLoading ? "Generating…" : "Generate sentence"}
            </button>
            {paragraph && (
              <button className="btn-accent" onClick={sendToReader}>Open in Smart Reader →</button>
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
