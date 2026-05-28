"use client";
import { useCallback, useEffect, useState } from "react";
import type { DailyGame, GameAttempt } from "@/lib/types";
import { PageHeader } from "./PageHeader";

type GameWithMax = DailyGame & { maxAttempts: number };

export function DailyClient() {
  const [game, setGame] = useState<GameWithMax | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/daily");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setGame(j.game as GameWithMax);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!game || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/daily/attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const attempt = j.attempt as GameAttempt;
      setGame((g) =>
        g
          ? {
              ...g,
              attempts: [attempt, ...g.attempts],
              attemptsUsed: j.attemptsUsed,
              solved: j.solved,
            }
          : g,
      );
      setText("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }, [game, text]);

  if (loading) return <div className="card text-sm text-ink/60">Loading today's image…</div>;
  if (error)
    return (
      <div className="card space-y-2">
        <div className="text-red-600">{error}</div>
        <button className="btn-outline" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!game) return null;

  const remaining = game.maxAttempts - game.attemptsUsed;
  const finished = game.solved || remaining <= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily image"
        subtitle={
          <>
            Describe today's image in Simplified Chinese. You have{" "}
            <b>{game.maxAttempts}</b> attempts. On attempt 2 the agent hints at
            what you missed; on attempt {game.maxAttempts} it reveals the full
            target.
          </>
        }
        meta={
          <>
            Day {game.dayKey} ·{" "}
            {finished
              ? game.solved
                ? "solved"
                : "out of attempts"
              : `${remaining} attempt${remaining === 1 ? "" : "s"} left`}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.imageUrl}
            alt="Today's image"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Your description</span>
              <span className="text-sm text-ink/60">
                Attempt {Math.min(game.attemptsUsed + 1, game.maxAttempts)} /{" "}
                {game.maxAttempts}
              </span>
            </div>
            <textarea
              className="textarea hanzi min-h-[100px] text-base"
              placeholder="用中文描述这张图片…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={finished || submitting}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="btn-primary"
                onClick={submit}
                disabled={finished || submitting || !text.trim()}
              >
                {submitting ? "Grading…" : "Submit"}
              </button>
              {finished && (
                <span className="text-sm text-ink/70">
                  {game.solved
                    ? "Solved! Come back tomorrow."
                    : "Out of attempts. Come back tomorrow."}
                </span>
              )}
            </div>
          </div>

          {game.attempts.length > 0 && (
            <div className="space-y-3">
              {game.attempts.map((a, i) => (
                <AttemptCard
                  key={game.attemptsUsed - i}
                  idx={game.attemptsUsed - i}
                  attempt={a}
                  isLatest={i === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttemptCard({
  idx,
  attempt,
  isLatest,
}: {
  idx: number;
  attempt: GameAttempt;
  isLatest: boolean;
}) {
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Attempt {idx}</span>
        <span
          className={
            attempt.solved
              ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              : attempt.score >= 60
                ? "rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          }
        >
          {attempt.score}/100 {attempt.solved ? "· solved" : ""}
        </span>
      </div>
      <div className="hanzi text-base">{attempt.prompt}</div>

      {attempt.grammar_errors.length > 0 && (
        <div className="rounded-md border border-ink/10 bg-paper p-2 text-sm">
          <div className="label mb-1">Grammar</div>
          <ul className="space-y-1">
            {attempt.grammar_errors.map((g, i) => (
              <li key={i}>
                <span className="line-through text-red-600">{g.wrong}</span>{" "}
                → <span className="font-medium">{g.correct}</span>
                <div className="text-xs text-ink/60">{g.explanation}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {attempt.missing_elements.length > 0 && (
        <div className="text-sm">
          <span className="label">You missed</span>{" "}
          {attempt.missing_elements.join(", ")}
        </div>
      )}

      {attempt.hint && (
        <div className="text-sm text-ink/80">
          <span className="label">Hint</span> {attempt.hint}
        </div>
      )}

      {attempt.reveal && (
        <div className="rounded-md border border-ink/10 bg-green-50 p-2">
          <div className="label mb-1 text-green-800">Target description</div>
          <div className="hanzi text-base">{attempt.reveal}</div>
        </div>
      )}

      {isLatest && !attempt.reveal && !attempt.solved && (
        <div className="text-xs text-ink/50">
          Try again with a more detailed description.
        </div>
      )}
    </div>
  );
}
