import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import type { Flashcard } from "@/lib/types";

/** SM-2 algorithm.
 * quality: 5 = Easy, 3 = Good, 1 = Hard / forgot */
function sm2(
  interval: number,
  ease: number,
  quality: 1 | 3 | 5,
): { interval: number; ease: number } {
  if (quality >= 3) {
    const mult = quality === 5 ? ease : ease * 0.85;
    const newInterval = Math.max(1, Math.round(interval * mult));
    const newEase = Math.max(
      1.3,
      ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
    return { interval: newInterval, ease: newEase };
  }
  return { interval: 1, ease: Math.max(1.3, ease - 0.15) };
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function cardToClient(c: {
  id: string; hanzi: string; pinyin: string; jyutping: string; definition: string;
  notes: string | null; dueAt: Date | null; interval: number; ease: number;
  reviewCount: number; createdAt: Date;
}): Flashcard {
  return {
    id: c.id,
    hanzi: c.hanzi,
    pinyin: c.pinyin,
    jyutping: c.jyutping,
    definition: c.definition,
    notes: c.notes,
    dueAt: c.dueAt?.toISOString() ?? null,
    interval: c.interval,
    ease: c.ease,
    reviewCount: c.reviewCount,
    createdAt: c.createdAt.toISOString(),
  };
}

/** GET /api/bucket/review — returns cards due today (dueAt <= now or dueAt is null for new). */
export const GET = withAuth(async (user) => {
  const now = new Date();
  const cards = await prisma.flashcard.findMany({
    where: {
      userId: user.id,
      OR: [{ dueAt: null }, { dueAt: { lte: now } }],
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: 20,
  });

  return NextResponse.json({ cards: cards.map(cardToClient) });
});

const RatingBody = z.object({
  id: z.string(),
  quality: z.union([z.literal(1), z.literal(3), z.literal(5)]),
});

/** POST /api/bucket/review — record a SM-2 rating and schedule the next review. */
export const POST = withAuth(async (user, req) => {
  const parsed = RatingBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { id, quality } = parsed.data;

  const card = await prisma.flashcard.findUnique({ where: { id } });
  if (!card || card.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { interval, ease } = sm2(card.interval, card.ease, quality);

  const updated = await prisma.flashcard.update({
    where: { id },
    data: {
      interval,
      ease,
      dueAt: daysFromNow(interval),
      reviewCount: { increment: 1 },
    },
  });

  return NextResponse.json({ flashcard: cardToClient(updated) });
});
