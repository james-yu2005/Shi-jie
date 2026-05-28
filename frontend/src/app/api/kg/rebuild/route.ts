import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getSessionUser } from "@/lib/auth";
import { asStringArray, deriveEdges } from "@/lib/kg";
import { prisma } from "@/lib/prisma";

type AnalyzeResponse = {
  pinyin: string;
  definition: string;
  radicals: string[];
  components: string[];
  semantic_tags: string[];
};

/**
 * Re-analyse every node in the user's graph with the current pipeline and
 * recompute all edges from scratch. Use this after upgrading the analyzer
 * (e.g. when we moved radical/component lookup from the LLM to the local
 * makemeahanzi dictionary) so old inconsistent strings get normalised and
 * new edges fall into place.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const nodes = await prisma.kgNode.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (nodes.length === 0) {
    return NextResponse.json({ nodesUpdated: 0, edgesCreated: 0 });
  }

  // First pass: re-analyse and write the normalised fields back. We feed
  // each call the running set of tags so the analyzer keeps clustering.
  const tagAccumulator = new Set<string>();
  const updated: typeof nodes = [];
  for (const node of nodes) {
    let analyzed: AnalyzeResponse | null = null;
    try {
      analyzed = await backendFetch<AnalyzeResponse>("/kg/analyze", {
        method: "POST",
        json: { hanzi: node.hanzi, existing_tags: [...tagAccumulator] },
      });
    } catch (e) {
      console.error("rebuild: kg/analyze failed for", node.hanzi, e);
    }
    if (analyzed) {
      const written = await prisma.kgNode.update({
        where: { id: node.id },
        data: {
          pinyin: analyzed.pinyin || node.pinyin,
          definition: analyzed.definition || node.definition,
          radicals: analyzed.radicals ?? [],
          components: analyzed.components ?? [],
          semanticTags: analyzed.semantic_tags ?? [],
        },
      });
      updated.push(written);
      for (const t of analyzed.semantic_tags ?? []) tagAccumulator.add(t);
    } else {
      updated.push(node);
      for (const t of asStringArray(node.semanticTags)) tagAccumulator.add(t);
    }
  }

  // Second pass: wipe edges and recompute deterministically.
  await prisma.kgEdge.deleteMany({ where: { userId: user.id } });

  const normalised = updated.map((n) => ({
    id: n.id,
    hanzi: n.hanzi,
    radicals: asStringArray(n.radicals),
    semanticTags: asStringArray(n.semanticTags),
  }));

  const toCreate: {
    userId: string;
    sourceId: string;
    targetId: string;
    type: string;
    reason: string;
    weight: number;
  }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < normalised.length; i++) {
    const subject = normalised[i];
    const rest = normalised.slice(i + 1);
    for (const edge of deriveEdges(subject, rest)) {
      const key = `${edge.sourceId}:${edge.targetId}:${edge.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toCreate.push({
        userId: user.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        type: edge.type,
        reason: edge.reason,
        weight: edge.weight,
      });
    }
  }
  if (toCreate.length > 0) {
    await prisma.kgEdge.createMany({ data: toCreate, skipDuplicates: true });
  }

  return NextResponse.json({
    nodesUpdated: updated.length,
    edgesCreated: toCreate.length,
  });
}
