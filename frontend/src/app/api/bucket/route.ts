import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const PostBody = z.object({
  hanzi: z.string().min(1),
  pinyin: z.string().default(""),
  definition: z.string().default(""),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cards = await prisma.flashcard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ flashcards: cards });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const card = await prisma.flashcard.upsert({
    where: { userId_hanzi: { userId: user.id, hanzi: data.hanzi } },
    create: { ...data, userId: user.id },
    update: {
      pinyin: data.pinyin,
      definition: data.definition,
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json({ flashcard: card });
}
