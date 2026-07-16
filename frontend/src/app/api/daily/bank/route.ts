import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

function asPhraseBank(value: unknown): VocabChip[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value as VocabChip[];
}

/** POST /api/daily/bank — ensure target desc + return/cache easy-mode phrase bank. */
export const POST = withAuth(async (user) => {
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

  const cached = asPhraseBank(game.phraseBank);
  if (cached && game.targetDesc) {
    return NextResponse.json({ phraseBank: cached, targetDesc: game.targetDesc });
  }

  const prefs = await getUserPreferences(user.id);
  const targetElements = Array.isArray(game.targetElements)
    ? (game.targetElements as string[])
    : [];

  let result: PrepareResult;
  try {
    result = await backendFetch<PrepareResult>("/daily/prepare", {
      method: "POST",
      json: {
        image_url: game.imageUrl,
        target_desc: game.targetDesc ?? null,
        target_elements: targetElements,
        ...backendLearningPrefs(prefs),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }

  const phraseBank = asPhraseBank(result.phrase_bank) ?? [];
  const nextTargetElements: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue =
    Array.isArray(game.targetElements)
      ? (game.targetElements as Prisma.InputJsonValue)
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
    phraseBank: asPhraseBank(updated.phraseBank) ?? phraseBank,
    targetDesc: updated.targetDesc,
  });
});
