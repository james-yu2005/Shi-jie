import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { getSessionUser } from "@/lib/auth";
import { asStringArray, deriveEdges } from "@/lib/kg";
import { prisma } from "@/lib/prisma";
import type { KgEdge, KgGraph, KgNode } from "@/lib/types";

const PostBody = z.object({
  hanzi: z.string().min(1).max(32),
  pinyin: z.string().optional(),
  definition: z.string().optional(),
  notes: z.string().optional().nullable(),
});

type AnalyzeResponse = {
  pinyin: string;
  definition: string;
  radicals: string[];
  components: string[];
  semantic_tags: string[];
};

function nodeToClient(n: {
  id: string;
  hanzi: string;
  pinyin: string;
  definition: string;
  radicals: unknown;
  components: unknown;
  semanticTags: unknown;
  notes: string | null;
  createdAt: Date;
}): KgNode {
  return {
    id: n.id,
    hanzi: n.hanzi,
    pinyin: n.pinyin,
    definition: n.definition,
    radicals: asStringArray(n.radicals),
    components: asStringArray(n.components),
    semanticTags: asStringArray(n.semanticTags),
    notes: n.notes,
    createdAt: n.createdAt.toISOString(),
  };
}

function edgeToClient(e: {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  reason: string;
  weight: number;
}): KgEdge {
  return {
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    type: e.type === "character" ? "character" : "meaning",
    reason: e.reason,
    weight: e.weight,
  };
}

export async function GET(): Promise<NextResponse<KgGraph | { error: string }>> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [nodes, edges] = await Promise.all([
    prisma.kgNode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.kgEdge.findMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    nodes: nodes.map(nodeToClient),
    edges: edges.map(edgeToClient),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { hanzi, pinyin, definition, notes } = parsed.data;

  // If the node already exists, return it (idempotent add-to-graph).
  const existing = await prisma.kgNode.findUnique({
    where: { userId_hanzi: { userId: user.id, hanzi } },
  });
  if (existing) {
    const edges = await prisma.kgEdge.findMany({
      where: {
        userId: user.id,
        OR: [{ sourceId: existing.id }, { targetId: existing.id }],
      },
    });
    return NextResponse.json({
      node: nodeToClient(existing),
      edges: edges.map(edgeToClient),
      created: false,
    });
  }

  const others = await prisma.kgNode.findMany({
    where: { userId: user.id },
  });

  // Bias the analyzer toward tags already in this user's graph so new
  // nodes cluster with existing ones instead of inventing synonym tags.
  const existingTags = Array.from(
    new Set(others.flatMap((o) => asStringArray(o.semanticTags))),
  );

  // Best-effort analysis. If the backend is down we still create the
  // node with empty radicals/tags so the user can build the graph manually.
  let analyzed: AnalyzeResponse = {
    pinyin: pinyin ?? "",
    definition: definition ?? "",
    radicals: [],
    components: [],
    semantic_tags: [],
  };
  try {
    const fromAi = await backendFetch<AnalyzeResponse>("/kg/analyze", {
      method: "POST",
      json: { hanzi, existing_tags: existingTags },
    });
    analyzed = {
      pinyin: pinyin || fromAi.pinyin,
      definition: definition || fromAi.definition,
      radicals: fromAi.radicals ?? [],
      components: fromAi.components ?? [],
      semantic_tags: fromAi.semantic_tags ?? [],
    };
  } catch (e) {
    console.error("kg/analyze failed", e);
  }
  const othersForDerive = others.map((o) => ({
    id: o.id,
    hanzi: o.hanzi,
    radicals: asStringArray(o.radicals),
    semanticTags: asStringArray(o.semanticTags),
  }));

  const created = await prisma.kgNode.create({
    data: {
      userId: user.id,
      hanzi,
      pinyin: analyzed.pinyin,
      definition: analyzed.definition,
      radicals: analyzed.radicals,
      components: analyzed.components,
      semanticTags: analyzed.semantic_tags,
      notes: notes ?? null,
    },
  });

  const derived = deriveEdges(
    {
      id: created.id,
      hanzi: created.hanzi,
      radicals: analyzed.radicals,
      semanticTags: analyzed.semantic_tags,
    },
    othersForDerive,
  );

  if (derived.length > 0) {
    await prisma.kgEdge.createMany({
      data: derived.map((d) => ({
        userId: user.id,
        sourceId: d.sourceId,
        targetId: d.targetId,
        type: d.type,
        reason: d.reason,
        weight: d.weight,
      })),
      skipDuplicates: true,
    });
  }

  const newEdges = await prisma.kgEdge.findMany({
    where: {
      userId: user.id,
      OR: [{ sourceId: created.id }, { targetId: created.id }],
    },
  });

  return NextResponse.json({
    node: nodeToClient(created),
    edges: newEdges.map(edgeToClient),
    created: true,
  });
}
