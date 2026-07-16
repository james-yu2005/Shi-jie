import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { withAuth } from "@/lib/auth";
import { asStringArray, deriveEdges, edgeToClient, nodeToClient } from "@/lib/kg";
import { resolveHanziForms } from "@/lib/hanzi-forms";
import { prisma } from "@/lib/prisma";

const PostBody = z.object({
  hanzi: z.string().min(1).max(32),
  pinyin: z.string().optional(),
  jyutping: z.string().optional(),
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

export const GET = withAuth(async (user) => {
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
});

export const POST = withAuth(async (user, req) => {
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { hanzi, pinyin, jyutping, definition, notes } = parsed.data;
  const forms = await resolveHanziForms(hanzi);

  // If the node already exists, return it (idempotent add-to-graph).
  const existing = await prisma.kgNode.findUnique({
    where: { userId_hanzi: { userId: user.id, hanzi: forms.simplified } },
  });
  if (existing) {
    const edges = await prisma.kgEdge.findMany({
      where: {
        userId: user.id,
        OR: [{ sourceId: existing.id }, { targetId: existing.id }],
      },
    });
    const clientEdges = edges.map(edgeToClient);
    return NextResponse.json({
      node: nodeToClient(existing),
      edges: clientEdges,
      newEdges: [],
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
      json: { hanzi: forms.simplified, existing_tags: existingTags },
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
      hanzi: forms.simplified,
      hanziTraditional: forms.traditional,
      pinyin: analyzed.pinyin,
      jyutping: jyutping ?? "",
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

  const linkedEdges = await prisma.kgEdge.findMany({
    where: {
      userId: user.id,
      OR: [{ sourceId: created.id }, { targetId: created.id }],
    },
  });
  const clientEdges = linkedEdges.map(edgeToClient);
  // Freshly derived edges for this add (Connection Bloom).
  const newEdgeKeys = new Set(
    derived.map((d) => [d.sourceId, d.targetId, d.type].join(":")),
  );
  const newEdges = clientEdges.filter((e) =>
    newEdgeKeys.has([e.sourceId, e.targetId, e.type].join(":")),
  );

  return NextResponse.json({
    node: nodeToClient(created),
    edges: clientEdges,
    newEdges,
    created: true,
  });
});
