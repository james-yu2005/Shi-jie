"use client";
import { useEffect, useMemo, useState } from "react";
import type { Flashcard } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TypingGame({ cards }: { cards: Flashcard[] }) {
  const deck = useMemo(() => shuffle(cards), [cards]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [scoreboard, setScoreboard] = useState<
    { id: string; correct: boolean | null }[]
  >([]);
  const [finished, setFinished] = useState(false);

  const card = deck[idx];

  useEffect(() => {
    setAnswer("");
    setRevealed(false);
  }, [idx]);

  if (finished || !card) {
    const correct = scoreboard.filter((s) => s.correct).length;
    return (
      <div className="card space-y-3">
        <h2 className="text-xl font-bold">Done!</h2>
        <p className="text-ink/70">
          You self-graded {correct} / {scoreboard.length} correct.
        </p>
        <button
          className="btn-primary"
          onClick={() => {
            setIdx(0);
            setScoreboard([]);
            setFinished(false);
          }}
        >
          Restart
        </button>
      </div>
    );
  }

  function next(correct: boolean | null) {
    setScoreboard((s) => [...s, { id: card.id, correct }]);
    if (idx + 1 >= deck.length) setFinished(true);
    else setIdx(idx + 1);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between text-sm text-ink/60">
        <span>
          Card {idx + 1} / {deck.length}
        </span>
        <span>Type the English definition; then reveal to self-grade.</span>
      </div>

      <div className="text-center">
        <div className="hanzi text-6xl font-bold">{card.hanzi}</div>
        {card.pinyin && (
          <div className="mt-1 text-ink/60">{card.pinyin}</div>
        )}
      </div>

      <input
        className="input text-base"
        placeholder="Type the English definition…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !revealed) setRevealed(true);
        }}
        disabled={revealed}
        autoFocus
      />

      {!revealed ? (
        <button className="btn-primary" onClick={() => setRevealed(true)}>
          Reveal definition
        </button>
      ) : (
        <>
          <div className="rounded-md border border-ink/10 bg-paper p-3">
            <div className="label mb-1">Real definition</div>
            <div className="text-sm">
              {card.definition || (
                <span className="italic text-ink/50">
                  (no saved definition — try clicking the word in the Reader to
                  fetch one)
                </span>
              )}
            </div>
            {card.notes && (
              <div className="mt-2">
                <div className="label mb-1">Context</div>
                <div className="hanzi text-sm">{card.notes}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-accent"
              onClick={() => next(true)}
              title="I got it right"
            >
              I was right ✓
            </button>
            <button
              className="btn-outline"
              onClick={() => next(false)}
              title="I was wrong"
            >
              I was wrong ✗
            </button>
            <button
              className="btn-outline ml-auto"
              onClick={() => next(null)}
              title="Skip"
            >
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}
