import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const word = url.searchParams.get("word");
  const context = url.searchParams.get("context") ?? "";
  if (!word) {
    return NextResponse.json({ error: "word required" }, { status: 400 });
  }
  const qs = new URLSearchParams({ word });
  if (context) qs.set("context", context);
  try {
    const data = await backendFetch(`/dictionary/lookup?${qs.toString()}`);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
