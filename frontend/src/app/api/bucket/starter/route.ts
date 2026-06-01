import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { HSK_100 } from "@/lib/hsk";

/** POST /api/bucket/starter — bulk-add the 100 HSK starter words to the user's bucket. */
export const POST = withAuth(async (user) => {
  // createMany + skipDuplicates is safe; existing words are left untouched.
  const result = await prisma.flashcard.createMany({
    data: HSK_100.map((w) => ({
      userId: user.id,
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      definition: w.definition,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ added: result.count });
});
