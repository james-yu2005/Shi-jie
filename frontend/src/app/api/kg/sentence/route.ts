import { NextResponse } from "next/server";
import { z } from "zod";
import { generateParagraph } from "@/lib/backend";
import { withAuth } from "@/lib/auth";
import { getUserPreferences } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  nodeIds: z.array(z.string()).min(1).max(40),
});

export const POST = withAuth(async (user, req) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const nodes = await prisma.kgNode.findMany({
    where: { userId: user.id, id: { in: parsed.data.nodeIds } },
  });
  if (nodes.length === 0) {
    return NextResponse.json({ error: "no nodes" }, { status: 400 });
  }

  const words = nodes.map((n) => n.hanzi);
  const prefs = await getUserPreferences(user.id);
  try {
    const data = await generateParagraph(words, prefs);
    return NextResponse.json({ paragraph: data.paragraph, words });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
});
