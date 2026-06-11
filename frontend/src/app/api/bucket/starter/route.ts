import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getUserPreferences } from "@/lib/preferences";
import { HSK_STARTER } from "@/lib/hsk";
import { toPreferredScriptSync } from "@/lib/script";

/** POST /api/bucket/starter — bulk-add the 50-word HSK starter deck to the user's bucket. */
export const POST = withAuth(async (user) => {
  const prefs = await getUserPreferences(user.id);
  const result = await prisma.flashcard.createMany({
    data: HSK_STARTER.map((w) => ({
      userId: user.id,
      hanzi: toPreferredScriptSync(w.hanzi, prefs.script),
      pinyin: w.pinyin,
      definition: w.definition,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ added: result.count });
});
