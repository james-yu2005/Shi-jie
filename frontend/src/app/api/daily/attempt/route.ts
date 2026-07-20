import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { backendLearningPrefs, getUserPreferences } from "@/lib/preferences";
import { DAILY_MAX_ATTEMPTS } from "@/lib/daily";

const Body = z.object({ text: z.string().min(1).max(500) });

type GradeResult = {
  score: number;
  solved: boolean;
  missing_elements: string[];
  grammar_errors: { wrong: string; correct: string; explanation: string }[];
  hint: string;
  reveal: string | null;
  vocab_hints?: { hanzi: string; pinyin: string; jyutping?: string; definition: string }[];
  target_desc?: string;
  target_elements?: string[];
};

const MAX_ATTEMPTS = DAILY_MAX_ATTEMPTS;

export const POST = withAuth(async (user, req) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const dayKey = new Date().toISOString().slice(0, 10);
  const game = await prisma.dailyGame.findUnique({
    where: { userId_dayKey: { userId: user.id, dayKey } },
  });
  if (!game) {
    return NextResponse.json(
      { error: "no game yet — GET /api/daily first" },
      { status: 404 },
    );
  }
  if (game.solved || game.attemptsUsed >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "game already finished" }, { status: 409 });
  }

  const attemptNumber = game.attemptsUsed + 1;
  const targetElements = Array.isArray(game.targetElements)
    ? (game.targetElements as string[])
    : [];
  const phraseBank = Array.isArray(game.phraseBank)
    ? (game.phraseBank as unknown[])
    : [];
  const prefs = await getUserPreferences(user.id);

  let result: GradeResult;
  try {
    result = await backendFetch<GradeResult>("/daily/grade", {
      method: "POST",
      json: {
        image_url: game.imageUrl,
        attempt_text: parsed.data.text,
        attempt_number: attemptNumber,
        max_attempts: MAX_ATTEMPTS,
        target_desc: game.targetDesc ?? null,
        target_elements: targetElements,
        difficulty: game.difficulty ?? "easy",
        phrase_bank: phraseBank,
        ...backendLearningPrefs(prefs),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }

  const prevAttempts = Array.isArray(game.attempts) ? (game.attempts as unknown[]) : [];
  const newAttempt = {
    prompt: parsed.data.text,
    score: result.score,
    solved: result.solved,
    missing_elements: result.missing_elements,
    grammar_errors: result.grammar_errors,
    hint: result.hint,
    reveal: result.reveal,
    vocab_hints: result.vocab_hints || [],
  };
  const newAttempts = [...prevAttempts, newAttempt];
  const solved = result.solved || game.solved;

  // targetElements is a nullable Json column: keep the cached value, else use
  // the freshly graded elements, else store SQL NULL.
  const nextTargetElements: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue =
    targetElements.length > 0
      ? (targetElements as Prisma.InputJsonValue)
      : (result.target_elements ?? Prisma.DbNull);

  const updated = await prisma.dailyGame.update({
    where: { id: game.id },
    data: {
      attempts: newAttempts as Prisma.InputJsonValue,
      attemptsUsed: attemptNumber,
      solved,
      targetDesc: game.targetDesc ?? result.target_desc ?? null,
      targetElements: nextTargetElements,
    },
  });

  return NextResponse.json({
    attempt: newAttempt,
    attemptsUsed: updated.attemptsUsed,
    solved: updated.solved,
    maxAttempts: MAX_ATTEMPTS,
    difficulty: updated.difficulty,
  });
});
