import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { getSessionUser } from "@/lib/auth";

const Body = z.object({ words: z.array(z.string().min(1)).min(1).max(50) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    const data = await backendFetch<{ paragraph: string }>("/ai/paragraph", {
      method: "POST",
      json: parsed.data,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
