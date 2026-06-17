"use client";
import { memo, useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import type { DailyGame, DailyDifficulty, GameAttempt, DailyStats } from "@/lib/types";
import { apiJson, swrFetcher } from "@/lib/api";
import { DAILY_EXAMPLE } from "@/lib/daily";
import { HeatmapCalendar } from "./HeatmapCalendar";
import { PageHeader } from "./PageHeader";
import { RomanizationLines } from "./WordHead";
import { Hanzi } from "./Hanzi";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";

type GameWithMax = DailyGame & { maxAttempts: number };

const DIFFICULTIES: DailyDifficulty[] = ["easy", "medium", "hard"];

const SEGMENT_BTN =
  "min-h-[44px] rounded-md px-3 py-2 text-sm capitalize transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent data-[active=true]:bg-ink data-[active=true]:text-white data-[active=true]:hover:bg-ink";

function scoreBadgeClass(attempt: GameAttempt): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium";
  if (attempt.solved) return `${base} bg-green-100 text-green-700`;
  if (attempt.score >= 60) return `${base} bg-yellow-100 text-yellow-800`;
  return `${base} bg-red-100 text-red-700`;
}

export function DailyClient() {
  const { preferences } = useLearningPreferences();
  const scriptLabel =
    preferences.script === "traditional" ? "Traditional Chinese" : "Simplified Chinese";
  const {
    data,
    error: loadError,
    isLoading,
    mutate,
  } = useSWR<{ game: GameWithMax }>("/api/daily", swrFetcher, {
    revalidateOnFocus: false,
  });
  const game = data?.game ?? null;

  const { data: stats } = useSWR<DailyStats>("/api/daily/history", swrFetcher, {
    revalidateOnFocus: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("easy");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (game) setDifficulty(game.difficulty ?? "easy");
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async () => {
    if (!game || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const j = await apiJson<{
        attempt: GameAttempt;
        attemptsUsed: number;
        solved: boolean;
      }>("/api/daily/attempt", { method: "POST", json: { text: text.trim() } });
      await mutate(
        (prev) =>
          prev
            ? {
                game: {
                  ...prev.game,
                  attempts: [j.attempt, ...prev.game.attempts],
                  attemptsUsed: j.attemptsUsed,
                  solved: j.solved,
                },
              }
            : prev,
        { revalidate: false },
      );
      setText("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }, [game, text, mutate]);

  const chooseDifficulty = useCallback(
    async (d: DailyDifficulty) => {
      if (!game || game.attemptsUsed > 0) return;
      const previous = difficulty;
      setDifficulty(d);
      try {
        const j = await apiJson<{ difficulty: DailyDifficulty }>("/api/daily", {
          method: "PATCH",
          json: { difficulty: d },
        });
        await mutate(
          (prev) => (prev ? { game: { ...prev.game, difficulty: j.difficulty } } : prev),
          { revalidate: false },
        );
      } catch (e) {
        setDifficulty(previous);
        setError(String(e));
      }
    },
    [game, difficulty, mutate],
  );

  if (isLoading && !game)
    return <div className="card text-sm text-ink/60">Loading today&apos;s image…</div>;

  const displayError = error ?? (loadError ? String(loadError) : null);
  if (displayError)
    return (
      <div className="card space-y-2">
        <div className="text-red-600">{displayError}</div>
        <button className="btn-outline" onClick={() => { setError(null); void mutate(); }}>
          Retry
        </button>
      </div>
    );

  if (!game) return null;

  const remaining = game.maxAttempts - game.attemptsUsed;
  const finished = game.solved || remaining <= 0;
  const difficultyLocked = game.attemptsUsed > 0;
  const statusLabel = finished
    ? game.solved ? "solved" : "out of attempts"
    : `${remaining} attempt${remaining === 1 ? "" : "s"} left`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Game"
        subtitle={
          <>
            Describe today&apos;s image in {scriptLabel}. You have{" "}
            <b>{game.maxAttempts}</b> attempts. On attempt 2 the agent hints at
            what you missed; on attempt {game.maxAttempts} it reveals the full
            target.
          </>
        }
        meta={
          <span className="flex items-center gap-2">
            Day {game.dayKey} · {statusLabel}
            {stats && stats.streak > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                🔥 {stats.streak}-day streak
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
            <span className="label">Difficulty</span>
            <div className="flex w-full items-center gap-1 rounded-lg border border-ink/15 bg-white p-1 sm:w-auto">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => chooseDifficulty(d)}
                  disabled={difficultyLocked}
                  data-active={difficulty === d}
                  className={`${SEGMENT_BTN} flex-1 sm:flex-none`}
                >
                  {d}
                </button>
              ))}
            </div>
            {difficultyLocked && (
              <span className="text-xs text-ink/50">Locked for today</span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm lg:sticky lg:top-[var(--header-offset)] lg:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.imageUrl}
            alt="Today's image"
            className="aspect-[4/3] w-full object-cover"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="space-y-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-2">
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

          {game.attempts.length > 0 ? (
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
          ) : (
            <DailyExampleShowcase />
          )}
        </div>
      </div>

      {/* Streak & history */}
      {stats && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="label">Activity</div>
              {stats.streak > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  🔥 {stats.streak}-day streak
                </span>
              )}
            </div>
            <button
              className="btn-ghost text-xs"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "Hide" : "Show"} calendar
            </button>
          </div>

          {showHistory && <HeatmapCalendar history={stats.history} />}
        </div>
      )}
    </div>
  );
}

function DailyExampleShowcase() {
  const [first, last] = DAILY_EXAMPLE.attempts;
  return (
    <div className="subtle-card space-y-4 border-dashed">
      <div>
        <div className="label mb-1">Example puzzle</div>
        <p className="text-sm text-ink/70">
          Describe the image in Chinese. After each attempt you get a score,
          vocabulary hints, coaching notes, and on your last attempt the full
          target answer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,160px)_1fr]">
        <div className="overflow-hidden rounded-lg border border-ink/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DAILY_EXAMPLE.imageUrl}
            alt="Example puzzle: orange cat on a desk"
            className="aspect-[4/3] w-full object-cover"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="space-y-2 text-sm">
          <div>
            <span className="label">You might write</span>
            <div className="hanzi mt-1 text-base"><Hanzi text={first.prompt} /></div>
          </div>
          <div>
            <span className="label">Target answer</span>
            <div className="hanzi mt-1 text-base text-green-800">
              <Hanzi text={DAILY_EXAMPLE.targetDesc} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AttemptCard idx={1} attempt={first} isLatest={false} example />
        <AttemptCard
          idx={3}
          attempt={last}
          isLatest={false}
          example
          exampleLabel="After more detail (or final attempt)"
        />
      </div>
    </div>
  );
}

const AttemptCard = memo(function AttemptCard({
  idx,
  attempt,
  isLatest,
  example = false,
  exampleLabel,
}: {
  idx: number;
  attempt: GameAttempt;
  isLatest: boolean;
  example?: boolean;
  exampleLabel?: string;
}) {
  return (
    <div className={`card space-y-2 ${example ? "border-dashed bg-paper/60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {example ? exampleLabel ?? `Attempt ${idx}` : `Attempt ${idx}`}
        </span>
        <div className="flex items-center gap-2">
          {example && (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/50">
              Example
            </span>
          )}
          <span className={scoreBadgeClass(attempt)}>
            {attempt.score}/100 {attempt.solved ? "· solved" : ""}
          </span>
        </div>
      </div>
      <div className="hanzi text-base"><Hanzi text={attempt.prompt} /></div>

      {attempt.grammar_errors.length > 0 && (
        <div className="rounded-md border border-ink/10 bg-paper p-2 text-sm">
          <div className="label mb-1">Grammar</div>
          <ul className="space-y-1">
            {attempt.grammar_errors.map((g, i) => (
              <li key={i}>
                <span className="line-through text-red-600"><Hanzi text={g.wrong} /></span>{" "}
                → <span className="font-medium"><Hanzi text={g.correct} /></span>
                <div className="text-xs text-ink/60">{g.explanation}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {attempt.missing_elements.length > 0 && (
        <div className="text-sm">
          <span className="label">You missed</span>{" "}
          {attempt.missing_elements.map((el, i) => (
            <span key={i}>
              {i > 0 && ", "}
              <Hanzi text={el} />
            </span>
          ))}
        </div>
      )}

      {attempt.vocab_hints && attempt.vocab_hints.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="label mb-2 text-blue-900">Learn these words</div>
          <div className="space-y-2">
            {attempt.vocab_hints.map((vocab, i) => (
              <div key={i} className="rounded bg-white p-2 shadow-sm">
                <div className="hanzi text-lg font-semibold"><Hanzi text={vocab.hanzi} /></div>
                <RomanizationLines
                  pinyin={vocab.pinyin}
                  jyutping={vocab.jyutping ?? ""}
                  compact
                  className="mt-1"
                />
                <div className="mt-1 text-sm text-ink/80">{vocab.definition}</div>
              </div>
            ))}
          </div>
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
          <div className="hanzi text-base"><Hanzi text={attempt.reveal} /></div>
        </div>
      )}

      {isLatest && !attempt.reveal && !attempt.solved && (
        <div className="text-xs text-ink/50">
          Try again with a more detailed description.
        </div>
      )}
    </div>
  );
});
