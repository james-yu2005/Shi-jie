"use client";
import type { DailyHistoryEntry } from "@/lib/types";

type Props = {
  history: DailyHistoryEntry[];
};

function cellClass(entry: DailyHistoryEntry | undefined, isToday: boolean): string {
  const base = "h-6 w-6 rounded-sm border transition-colors";
  const today = isToday ? " ring-1 ring-ink/30 ring-offset-1" : "";
  if (!entry || entry.attemptsUsed === 0)
    return `${base}${today} border-ink/10 bg-paper`;
  if (entry.solved)
    return `${base}${today} border-green-300 bg-green-400`;
  return `${base}${today} border-yellow-300 bg-yellow-300`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function HeatmapCalendar({ history }: Props) {
  const byDay = new Map(history.map((h) => [h.dayKey, h]));
  const today = new Date();
  const todayKey = isoDate(today);

  // Build a 28-day grid (4 weeks × 7 days), newest day last
  const days: Date[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startDow = days[0].getUTCDay(); // day-of-week offset for first week

  return (
    <div className="space-y-2">
      {/* day-of-week header */}
      <div className="flex gap-1.5">
        {dayLabels.map((l) => (
          <div key={l} className="w-6 text-center text-[10px] text-ink/40">
            {l.slice(0, 1)}
          </div>
        ))}
      </div>

      {/* grid — 4 rows of 7 */}
      <div className="space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1.5">
            {/* offset first week */}
            {wi === 0 &&
              Array.from({ length: startDow }).map((_, j) => (
                <div key={`offset-${j}`} className="h-6 w-6" />
              ))}
            {week.map((d) => {
              const key = isoDate(d);
              const entry = byDay.get(key);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={cellClass(entry, isToday)}
                  title={
                    entry
                      ? `${key}: ${entry.solved ? "solved" : `${entry.attemptsUsed} attempt${entry.attemptsUsed === 1 ? "" : "s"}`}`
                      : key
                  }
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* legend */}
      <div className="flex items-center gap-3 text-xs text-ink/50">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-ink/10 bg-paper" /> None
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-yellow-300 bg-yellow-300" /> Tried
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-green-300 bg-green-400" /> Solved
        </span>
      </div>
    </div>
  );
}
