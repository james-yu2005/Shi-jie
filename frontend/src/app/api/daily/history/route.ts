import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import type { DailyHistoryEntry, DailyStats } from "@/lib/types";

function computeStreak(
  history: DailyHistoryEntry[],
  todayKey: string,
): number {
  if (history.length === 0) return 0;

  // history is sorted newest-first; walk back checking consecutive days
  const byDay = new Map(history.map((h) => [h.dayKey, h]));
  let streak = 0;
  let cursor = new Date(todayKey + "T00:00:00Z");

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    if (!entry || entry.attemptsUsed === 0) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** GET /api/daily/history — returns 30-day history + current streak. */
export const GET = withAuth(async (user) => {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29); // inclusive 30-day window
  const sinceKey = since.toISOString().slice(0, 10);

  const games = await prisma.dailyGame.findMany({
    where: { userId: user.id, dayKey: { gte: sinceKey } },
    select: { dayKey: true, solved: true, attemptsUsed: true },
    orderBy: { dayKey: "desc" },
  });

  const history: DailyHistoryEntry[] = games.map((g) => ({
    dayKey: g.dayKey,
    solved: g.solved,
    attemptsUsed: g.attemptsUsed,
  }));

  const todayKey = new Date().toISOString().slice(0, 10);
  const streak = computeStreak(history, todayKey);

  const stats: DailyStats = { streak, history };
  return NextResponse.json(stats);
});
