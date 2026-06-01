import { NextResponse } from "next/server";
import { z } from "zod";
import { generateParagraph } from "@/lib/backend";
import { withAuth } from "@/lib/auth";

const Body = z.object({ words: z.array(z.string().min(1)).min(1).max(50) });

export const POST = withAuth(async (_user, req) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json(await generateParagraph(parsed.data.words));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
});
