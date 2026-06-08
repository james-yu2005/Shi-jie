import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { attemptsNewestFirst, DAILY_MAX_ATTEMPTS } from "@/lib/daily";
import type { GameAttempt } from "@/lib/types";

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function imageForDay(key: string): string {
  // Seed-based Picsum: always returns an image (no 404 risk), consistent per day.
  return `https://picsum.photos/seed/shijie-${key}/800/600`;
}

const PatchBody = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const PATCH = withAuth(async (user, req) => {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const key = dayKey();
  const game = await prisma.dailyGame.findUnique({
    where: { userId_dayKey: { userId: user.id, dayKey: key } },
  });
  if (!game) {
    return NextResponse.json(
      { error: "no game yet — GET /api/daily first" },
      { status: 404 },
    );
  }

  // Lock the choice once the challenge has started.
  if (game.attemptsUsed > 0) {
    return NextResponse.json(
      { error: "difficulty is locked after the first attempt" },
      { status: 409 },
    );
  }

  const updated = await prisma.dailyGame.update({
    where: { id: game.id },
    data: { difficulty: parsed.data.difficulty },
  });

  return NextResponse.json({ difficulty: updated.difficulty });
});

export const GET = withAuth(async (user) => {
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
      difficulty: game.difficulty ?? "easy",
    },
  });
});
