import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { KgSuggestion } from "@/lib/types";

const Body = z.object({
  focusId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const focus = await prisma.kgNode.findUnique({
    where: { id: parsed.data.focusId },
  });
  if (!focus || focus.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const existing = await prisma.kgNode.findMany({
    where: { userId: user.id },
    select: { hanzi: true, radicals: true, semanticTags: true },
  });

  const existingTags = Array.from(
    new Set(
      existing.flatMap((e) => {
        const arr = e.semanticTags;
        return Array.isArray(arr)
          ? arr.filter((x): x is string => typeof x === "string")
          : [];
      }),
    ),
  );
  const existingRadicals = Array.from(
    new Set(
      existing.flatMap((e) => {
        const arr = e.radicals;
        return Array.isArray(arr)
          ? arr.filter((x): x is string => typeof x === "string")
          : [];
      }),
    ),
  );

  try {
    const data = await backendFetch<{ suggestions: KgSuggestion[] }>(
      "/kg/suggest",
      {
        method: "POST",
        json: {
          focus: focus.hanzi,
          existing: existing.map((e) => e.hanzi),
          existing_tags: existingTags,
          existing_radicals: existingRadicals,
        },
      },
    );
    return NextResponse.json({ suggestions: data.suggestions ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
