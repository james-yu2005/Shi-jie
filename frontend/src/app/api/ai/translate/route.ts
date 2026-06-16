import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";

const Body = z.object({ text: z.string().min(1).max(20000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    const data = await backendFetch("/ai/translate", {
      method: "POST",
      json: parsed.data,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
