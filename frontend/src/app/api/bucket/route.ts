import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveHanziForms } from "@/lib/hanzi-forms";

const PostBody = z.object({
  hanzi: z.string().min(1),
  pinyin: z.string().default(""),
  jyutping: z.string().default(""),
  definition: z.string().default(""),
  notes: z.string().optional().nullable(),
});

export const GET = withAuth(async (user) => {
  const cards = await prisma.flashcard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ flashcards: cards });
});

export const POST = withAuth(async (user, req) => {
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const forms = await resolveHanziForms(data.hanzi);
  const card = await prisma.flashcard.upsert({
    where: { userId_hanzi: { userId: user.id, hanzi: forms.simplified } },
    create: {
      hanzi: forms.simplified,
      hanziTraditional: forms.traditional,
      pinyin: data.pinyin,
      jyutping: data.jyutping,
      definition: data.definition,
      notes: data.notes ?? null,
      userId: user.id,
    },
    update: {
      hanziTraditional: forms.traditional,
      pinyin: data.pinyin,
      jyutping: data.jyutping,
      definition: data.definition,
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json({ flashcard: card });
});
