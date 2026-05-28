import { redirect } from "next/navigation";
import { GraphClient } from "@/components/GraphClient";
import { getSessionUser } from "@/lib/auth";
import { asStringArray } from "@/lib/kg";
import { prisma } from "@/lib/prisma";
import type { KgEdge, KgEdgeType, KgNode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [nodes, edges] = await Promise.all([
    prisma.kgNode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.kgEdge.findMany({ where: { userId: user.id } }),
  ]);

  const clientNodes: KgNode[] = nodes.map((n) => ({
    id: n.id,
    hanzi: n.hanzi,
    pinyin: n.pinyin,
    definition: n.definition,
    radicals: asStringArray(n.radicals),
    components: asStringArray(n.components),
    semanticTags: asStringArray(n.semanticTags),
    notes: n.notes,
    createdAt: n.createdAt.toISOString(),
  }));

  const clientEdges: KgEdge[] = edges.map((e) => ({
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    type: (e.type === "character" ? "character" : "meaning") as KgEdgeType,
    reason: e.reason,
    weight: e.weight,
  }));

  return <GraphClient initialNodes={clientNodes} initialEdges={clientEdges} />;
}
