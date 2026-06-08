import { NextResponse } from "next/server";
import { z } from "zod";
import { generateParagraph } from "@/lib/backend";
import { withAuth } from "@/lib/auth";
import { AI_SENTENCE_MAX_WORDS } from "@/lib/hsk";

const Body = z.object({ words: z.array(z.string().min(1)).min(1) });

export const POST = withAuth(async (_user, req) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Add at least one word to your bucket." }, { status: 400 });
  }
  if (parsed.data.words.length > AI_SENTENCE_MAX_WORDS) {
    const excess = parsed.data.words.length - AI_SENTENCE_MAX_WORDS;
    return NextResponse.json(
      {
        error: `AI sentence supports up to ${AI_SENTENCE_MAX_WORDS} words. You have ${parsed.data.words.length} — remove ${excess} from your bucket and try again.`,
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await generateParagraph(parsed.data.words));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
});
