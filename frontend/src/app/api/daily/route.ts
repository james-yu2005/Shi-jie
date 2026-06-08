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
  // Use a curated set of simple picsum photo IDs that show clear, simple subjects
  // Cycling through them ensures variety while keeping images simple and learner-friendly
  const simplePhotoIds = [
    237, 292, 169, 180, 225, 177, 164, 168, 181, 203,  // animals, nature
    312, 326, 365, 431, 441, 511, 551, 593, 659, 718,  // objects, food
    783, 815, 844, 866, 901, 922, 944, 996, 1015, 1036, // landscapes
  ];
  
  // Hash the day key to pick a consistent photo ID
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const photoId = simplePhotoIds[hash % simplePhotoIds.length];
  
  // Picsum with specific ID - reliable, simple images
  return `https://picsum.photos/id/${photoId}/800/600`;
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
