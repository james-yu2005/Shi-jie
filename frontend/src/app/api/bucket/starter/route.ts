import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { HSK_STARTER } from "@/lib/hsk";
import { hanziFormsFromText } from "@/lib/script";

/** POST /api/bucket/starter — bulk-add the 50-word HSK starter deck to the user's bucket. */
export const POST = withAuth(async (user) => {
  const result = await prisma.flashcard.createMany({
    data: HSK_STARTER.map((w) => {
      const forms = hanziFormsFromText(w.hanzi);
      return {
        userId: user.id,
        hanzi: forms.simplified,
        hanziTraditional: forms.traditional,
        pinyin: w.pinyin,
        definition: w.definition,
      };
    }),
    skipDuplicates: true,
  });

  return NextResponse.json({ added: result.count });
});
