import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const node = await prisma.kgNode.findUnique({ where: { id: params.id } });
  if (!node || node.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Edges have ON DELETE CASCADE on both source and target.
  await prisma.kgNode.delete({ where: { id: node.id } });
  return NextResponse.json({ ok: true });
}
