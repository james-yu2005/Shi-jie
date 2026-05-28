import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  nodeIds: z.array(z.string()).min(1).max(40),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  try {
    const data = await backendFetch<{ paragraph: string }>("/ai/paragraph", {
      method: "POST",
      json: { words: nodes.map((n) => n.hanzi) },
    });
    return NextResponse.json({
      paragraph: data.paragraph,
      words: nodes.map((n) => n.hanzi),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
