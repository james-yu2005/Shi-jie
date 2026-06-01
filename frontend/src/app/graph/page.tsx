import { redirect } from "next/navigation";
import { GraphClient } from "@/components/GraphClient";
import { getSessionUser } from "@/lib/auth";
import { edgeToClient, nodeToClient } from "@/lib/kg";
import { prisma } from "@/lib/prisma";

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

  return (
    <GraphClient
      initialNodes={nodes.map(nodeToClient)}
      initialEdges={edges.map(edgeToClient)}
    />
  );
}
