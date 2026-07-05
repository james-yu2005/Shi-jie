import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { enforceRateLimit } from "@/lib/rate-limit";

const LIMIT = 120;
const WINDOW_MS = 60 * 1000;

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "dictionary-lookup", LIMIT, WINDOW_MS);
  if (limited) return limited;

  const url = new URL(req.url);
  const word = url.searchParams.get("word");
  if (!word) {
    return NextResponse.json({ error: "word required" }, { status: 400 });
  }
  const audio = url.searchParams.get("audio") ?? "mandarin";
  const qs = new URLSearchParams({ word, audio });
  try {
    const data = await backendFetch(`/dictionary/lookup?${qs.toString()}`);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
