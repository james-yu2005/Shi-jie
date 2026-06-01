import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DELETE = withAuth<{ params: { id: string } }>(
  async (user, _req, { params }) => {
    const node = await prisma.kgNode.findUnique({ where: { id: params.id } });
    if (!node || node.userId !== user.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    // Edges have ON DELETE CASCADE on both source and target.
    await prisma.kgNode.delete({ where: { id: node.id } });
    return NextResponse.json({ ok: true });
  },
);
