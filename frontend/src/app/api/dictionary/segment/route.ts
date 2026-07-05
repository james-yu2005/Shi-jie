import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({ text: z.string().min(1).max(20000) });

const LIMIT = 60;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "dictionary-segment", LIMIT, WINDOW_MS);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    const data = await backendFetch("/dictionary/segment", {
      method: "POST",
      json: parsed.data,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
