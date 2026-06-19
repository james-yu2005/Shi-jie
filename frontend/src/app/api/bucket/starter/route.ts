import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { HSK_STARTER, STARTER_DECK_SIZE } from "@/lib/hsk";
import { hanziFormsFromText } from "@/lib/script";
import type { DictLookup } from "@/lib/types";

async function lookupJyutping(hanzi: string): Promise<{ pinyin: string; jyutping: string }> {
  try {
    const data = await backendFetch<DictLookup>(
      `/dictionary/lookup?word=${encodeURIComponent(hanzi)}&audio=cantonese`,
    );
    const entry = data.entries[0];
    return {
      pinyin: entry?.pinyin || entry?.pinyin_numbered || "",
      jyutping: entry?.jyutping ?? "",
    };
  } catch {
    return { pinyin: "", jyutping: "" };
  }
}

/** POST /api/bucket/starter — bulk-add the HSK starter deck to the user's bucket. */
export const POST = withAuth(async (user) => {
  const rows = await Promise.all(
    HSK_STARTER.map(async (w) => {
      const forms = hanziFormsFromText(w.hanzi);
      const romanization = await lookupJyutping(w.hanzi);
      return {
        userId: user.id,
        hanzi: forms.simplified,
        hanziTraditional: forms.traditional,
        pinyin: romanization.pinyin || w.pinyin,
        jyutping: romanization.jyutping,
        definition: w.definition,
      };
    }),
  );

  const result = await prisma.flashcard.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return NextResponse.json({ added: result.count, deckSize: STARTER_DECK_SIZE });
});
