import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { withAuth } from "@/lib/auth";
import { backendLearningPrefs, getUserPreferences } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

export const POST = withAuth(async (user, req) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { sourceId, targetId } = parsed.data;

  const [source, target] = await Promise.all([
    prisma.kgNode.findUnique({ where: { id: sourceId } }),
    prisma.kgNode.findUnique({ where: { id: targetId } }),
  ]);
  if (
    !source ||
    !target ||
    source.userId !== user.id ||
    target.userId !== user.id
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const edges = await prisma.kgEdge.findMany({
    where: {
      userId: user.id,
      OR: [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ],
    },
  });

  try {
    const prefs = await getUserPreferences(user.id);
    const data = await backendFetch<{ explanation: string }>(
      "/kg/connection",
      {
        method: "POST",
        json: {
          word_a: source.hanzi,
          word_b: target.hanzi,
          edges: edges.map((e) => ({ type: e.type, reason: e.reason })),
          ...backendLearningPrefs(prefs),
        },
      },
    );
    return NextResponse.json({
      explanation: data.explanation,
      edges: edges.map((e) => ({ type: e.type, reason: e.reason })),
    });
  } catch (e) {
    // Fall back to just stitching the stored reasons together so the
    // feature still works when the AI backend is unreachable.
    const fallback = edges.length
      ? edges.map((e) => e.reason).join(" · ")
      : "These words don't share a stored connection yet.";
    return NextResponse.json({
      explanation: fallback,
      edges: edges.map((e) => ({ type: e.type, reason: e.reason })),
      backendError: String(e),
    });
  }
});
