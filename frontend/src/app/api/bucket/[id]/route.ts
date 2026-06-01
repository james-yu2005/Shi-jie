import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

type Ctx = { params: { id: string } };

const PatchBody = z.object({
  pinyin: z.string().optional(),
  definition: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const PATCH = withAuth<Ctx>(async (user, req, { params }) => {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const card = await prisma.flashcard.findUnique({ where: { id: params.id } });
  if (!card || card.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const updated = await prisma.flashcard.update({
    where: { id: card.id },
    data: parsed.data,
  });
  return NextResponse.json({ flashcard: updated });
});

export const DELETE = withAuth<Ctx>(async (user, _req, { params }) => {
  const card = await prisma.flashcard.findUnique({ where: { id: params.id } });
  if (!card || card.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.flashcard.delete({ where: { id: card.id } });
  return NextResponse.json({ ok: true });
});
