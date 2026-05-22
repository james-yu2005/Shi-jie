import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const PatchBody = z.object({
  pinyin: z.string().optional(),
  definition: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const card = await prisma.flashcard.findUnique({ where: { id: params.id } });
  if (!card || card.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.flashcard.delete({ where: { id: card.id } });
  return NextResponse.json({ ok: true });
}
