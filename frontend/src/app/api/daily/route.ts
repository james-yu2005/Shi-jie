import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { attemptsNewestFirst, DAILY_MAX_ATTEMPTS } from "@/lib/daily";
import type { GameAttempt } from "@/lib/types";

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function imageForDay(key: string): string {
  return `https://picsum.photos/seed/shijie-${key}/800/600`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = dayKey();
  const game = await prisma.dailyGame.upsert({
    where: { userId_dayKey: { userId: user.id, dayKey: key } },
    create: {
      userId: user.id,
      dayKey: key,
      imageUrl: imageForDay(key),
      attempts: [],
    },
    update: {},
  });
  return NextResponse.json({
    game: {
      id: game.id,
      dayKey: game.dayKey,
      imageUrl: game.imageUrl,
      targetDesc: game.targetDesc,
      attempts: Array.isArray(game.attempts)
        ? attemptsNewestFirst(game.attempts as GameAttempt[])
        : [],
      attemptsUsed: game.attemptsUsed,
      solved: game.solved,
      maxAttempts: DAILY_MAX_ATTEMPTS,
    },
  });
}
