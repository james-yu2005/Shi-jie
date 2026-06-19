"use client";
import { useCallback, useState } from "react";
import useSWR from "swr";
import type { Flashcard } from "@/lib/types";
import { apiJson, swrFetcher } from "@/lib/api";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";
import { RomanizationLines } from "./WordHead";

type Quality = 1 | 3 | 5;

type Props = { onDone?: () => void };

export function ReviewMode({ onDone }: Props) {
  const { displayStoredHanzi } = useLearningPreferences();
  const { data, mutate, isLoading } = useSWR<{ cards: Flashcard[] }>(
    "/api/bucket/review",
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const cards = data?.cards ?? [];
  const card = cards[idx];
  const total = cards.length;
  const rate = useCallback(
    async (quality: Quality) => {
      if (!card) return;
      setRating(true);
      try {
        await apiJson(`/api/bucket/review`, { method: "POST", json: { id: card.id, quality } });
      } catch {
        // best-effort; continue session even on error
      } finally {
        setRating(false);
      }

      const next = idx + 1;
      if (next >= total) {
        setSessionDone(true);
        void mutate();
      } else {
        setIdx(next);
        setFlipped(false);
      }
    },
    [card, idx, total, mutate],
  );

  if (isLoading) {
    return <div className="card text-sm text-ink/60">Loading review cards…</div>;
  }

  if (total === 0 || sessionDone) {
    return (
      <div className="card space-y-4 text-center">
        {sessionDone ? (
          <>
            <div className="text-2xl">🎉</div>
            <p className="font-semibold">Session complete!</p>
            <p className="text-sm text-ink/60">
              You reviewed {total} card{total === 1 ? "" : "s"}. Come back
              tomorrow for more.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">All caught up!</p>
            <p className="text-sm text-ink/60">No cards are due right now.</p>
          </>
        )}
        {onDone && (
          <button className="btn-outline" onClick={onDone}>
            ← Back to bucket
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-ink/60">
          {idx + 1} / {total}
        </span>
      </div>

      {/* card */}
      <div
        className="card flex min-h-[140px] cursor-pointer flex-col items-center justify-center space-y-2 px-3 py-4 select-none sm:min-h-[220px] sm:space-y-3"
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className="hanzi text-4xl font-bold sm:text-5xl">
          {displayStoredHanzi(card.hanzi, card.hanziTraditional)}
        </div>

        {!flipped && (
          <p className="text-sm text-ink/50">tap to reveal</p>
        )}

        {flipped && (
          <div className="mt-2 space-y-2 text-center">
            <RomanizationLines pinyin={card.pinyin} jyutping={card.jyutping ?? ""} />
            <div className="text-sm">{card.definition}</div>
            {card.notes && (
              <div className="text-xs text-ink/50 italic">{card.notes}</div>
            )}
          </div>
        )}
      </div>

      {/* rating buttons — only visible after flip */}
      {flipped && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            className="btn-outline !min-h-10 border-red-200 px-2 py-1.5 text-red-600 hover:bg-red-50 sm:!min-h-[44px] sm:px-3 sm:py-2"
            onClick={() => rate(1)}
            disabled={rating}
          >
            <span className="block text-xs font-semibold">Hard</span>
            <span className="block text-xs text-ink/50">retry soon</span>
          </button>
          <button
            className="btn-outline !min-h-10 px-2 py-1.5 sm:!min-h-[44px] sm:px-3 sm:py-2"
            onClick={() => rate(3)}
            disabled={rating}
          >
            <span className="block text-xs font-semibold">Good</span>
            <span className="block text-xs text-ink/50">
              {Math.max(1, Math.round(card.interval * card.ease * 0.85))}d
            </span>
          </button>
          <button
            className="btn-outline !min-h-10 border-green-200 px-2 py-1.5 text-green-700 hover:bg-green-50 sm:!min-h-[44px] sm:px-3 sm:py-2"
            onClick={() => rate(5)}
            disabled={rating}
          >
            <span className="block text-xs font-semibold">Easy</span>
            <span className="block text-xs text-ink/50">
              {Math.max(1, Math.round(card.interval * card.ease))}d
            </span>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink/40">
          Reviewed {card.reviewCount} time{card.reviewCount === 1 ? "" : "s"}
        </span>
        {onDone && (
          <button className="btn-ghost text-xs" onClick={onDone}>
            Exit
          </button>
        )}
      </div>
    </div>
  );
}
