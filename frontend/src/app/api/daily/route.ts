import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  attemptsNewestFirst,
  dayKey,
  DAILY_MAX_ATTEMPTS,
  imageForDay,
  isLegacyDailyImageUrl,
} from "@/lib/daily";
import type { GameAttempt, VocabChip } from "@/lib/types";

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
  const imageUrl = imageForDay(key);

  let game = await prisma.dailyGame.findUnique({
    where: { userId_dayKey: { userId: user.id, dayKey: key } },
  });

  if (!game) {
    game = await prisma.dailyGame.create({
      data: {
        userId: user.id,
        dayKey: key,
        imageUrl,
        attempts: [],
      },
    });
  } else if (
    isLegacyDailyImageUrl(game.imageUrl) ||
    (game.attemptsUsed === 0 && game.imageUrl !== imageUrl)
  ) {
    game = await prisma.dailyGame.update({
      where: { id: game.id },
      data: { imageUrl },
    });
  }
  const phraseBank = Array.isArray(game.phraseBank)
    ? (game.phraseBank as VocabChip[])
    : null;

  return NextResponse.json({
    game: {
      id: game.id,
      dayKey: game.dayKey,
      imageUrl: game.imageUrl,
      attempts: Array.isArray(game.attempts)
        ? attemptsNewestFirst(game.attempts as GameAttempt[])
        : [],
      attemptsUsed: game.attemptsUsed,
      solved: game.solved,
      maxAttempts: DAILY_MAX_ATTEMPTS,
      difficulty: game.difficulty ?? "easy",
      phraseBank,
    },
  });
});
