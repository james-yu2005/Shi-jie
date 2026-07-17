import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { backendLearningPrefs, getUserPreferences } from "@/lib/preferences";
import { dayKey } from "@/lib/daily";
import type { VocabChip } from "@/lib/types";

type PrepareResult = {
  target_desc?: string;
  target_elements?: string[];
  phrase_bank?: VocabChip[];
};

const Body = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

function asPhraseBank(value: unknown): VocabChip[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value as VocabChip[];
}

/** POST /api/daily/bank — ensure target desc + return/cache phrase bank (easy/medium). */
export const POST = withAuth(async (user, req) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid difficulty and retry." }, { status: 400 });
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

  const difficulty = game.difficulty ?? "easy";
  if (parsed.data.difficulty !== difficulty) {
    return NextResponse.json(
      { error: "Difficulty changed while loading. Please retry." },
      { status: 409 },
    );
  }
  if (difficulty === "hard" || game.attemptsUsed > 0) {
    return NextResponse.json({ phraseBank: [] });
  }

  const cached = asPhraseBank(game.phraseBank);
  if (cached && cached.length >= 3 && game.targetDesc) {
    return NextResponse.json({
      phraseBank: cached.slice(0, difficulty === "medium" ? 3 : 6),
    });
  }

  const prefs = await getUserPreferences(user.id);
  const targetElements = Array.isArray(game.targetElements)
    ? (game.targetElements as string[])
    : [];

  let result: PrepareResult;
  try {
    // Always prepare the full (easy-sized) bank; the client trims for medium.
    result = await backendFetch<PrepareResult>("/daily/prepare", {
      method: "POST",
      json: {
        image_url: game.imageUrl,
        target_desc: game.targetDesc ?? null,
        target_elements: targetElements,
        difficulty: "easy",
        ...backendLearningPrefs(prefs),
      },
    });
  } catch (e) {
    console.error("Daily phrase bank preparation failed", e);
    return NextResponse.json(
      { error: "The image phrase service is temporarily unavailable. Please retry." },
      { status: 502 },
    );
  }

  const phraseBank = (asPhraseBank(result.phrase_bank) ?? []).slice(0, 6);
  if (phraseBank.length < 3 || !result.target_desc) {
    console.error("Daily phrase bank preparation returned no image-derived words");
    return NextResponse.json(
      { error: "No phrase suggestions were generated for this image. Please retry." },
      { status: 502 },
    );
  }
  const nextTargetElements: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue =
    targetElements.length > 0
      ? (targetElements as Prisma.InputJsonValue)
      : (result.target_elements ?? Prisma.DbNull);

  const updated = await prisma.dailyGame.update({
    where: { id: game.id },
    data: {
      targetDesc: game.targetDesc ?? result.target_desc ?? null,
      targetElements: nextTargetElements,
      phraseBank: phraseBank as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    phraseBank: (asPhraseBank(updated.phraseBank) ?? phraseBank).slice(
      0,
      difficulty === "medium" ? 3 : 6,
    ),
  });
});
