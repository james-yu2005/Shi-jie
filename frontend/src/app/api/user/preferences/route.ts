import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type RawUserPreferences,
} from "@/lib/preferences";
import { prisma } from "@/lib/prisma";

const PREF_SELECT = { script: true, audio: true } as const;

const PatchBody = z
  .object({
    script: z.enum(["simplified", "traditional"]).optional(),
    audio: z.enum(["mandarin", "cantonese"]).optional(),
  })
  .refine((body) => body.script !== undefined || body.audio !== undefined, {
    message: "At least one preference field is required",
  });

export const GET = withAuth(async (user) => {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: PREF_SELECT,
  });
  return NextResponse.json(normalizePreferences((row ?? {}) satisfies RawUserPreferences));
});

export const PATCH = withAuth(async (user, req) => {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: PREF_SELECT,
  });
  const merged = normalizePreferences({
    ...DEFAULT_PREFERENCES,
    ...(current ?? {}),
    ...parsed.data,
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { script: merged.script, audio: merged.audio },
    select: PREF_SELECT,
  });

  return NextResponse.json(normalizePreferences(updated satisfies RawUserPreferences));
});
