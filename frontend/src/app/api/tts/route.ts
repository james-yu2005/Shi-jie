import { NextResponse } from "next/server";
import { ttsUrl } from "@/lib/audio";
import type { AudioPreference } from "@/lib/types";

const MAX_CHARS = 200;

const AUDIO_VALUES = new Set<AudioPreference>(["mandarin", "cantonese"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text")?.trim();
  const rawAudio = url.searchParams.get("audio") ?? "mandarin";
  const audio: AudioPreference = AUDIO_VALUES.has(rawAudio as AudioPreference)
    ? (rawAudio as AudioPreference)
    : "mandarin";

  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: `maximum ${MAX_CHARS} characters` }, { status: 400 });
  }

  try {
    const upstream = await fetch(ttsUrl(text, audio), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "tts upstream failed" }, { status: 502 });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
