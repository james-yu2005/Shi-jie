import { NextResponse } from "next/server";
import {
  TRANSLATE_HANZI_LIMIT,
  countHanzi,
  trimToHanziLimit,
} from "@/lib/chinese";
import { enforceRateLimit } from "@/lib/rate-limit";

const LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;

const JINRISHICI_URL = "https://v2.jinrishici.com/sentence";

type JinrishiciResponse = {
  status: string;
  data?: {
    content?: string;
    origin?: {
      title?: string;
      author?: string;
      dynasty?: string;
      content?: string[];
    };
  };
};

const FALLBACK_SAMPLES = [
  "今天天气很好，我和朋友一起去公园散步。我们看见许多花在开，心情非常高兴。",
  "学习中文需要每天练习。听、说、读、写都很重要，但是最重要的是坚持。",
  "这家饭馆的菜很好吃，价格也不贵。服务员很热情，我们下次还会再来。",
];

function pickFallback(): string {
  return trimToHanziLimit(
    FALLBACK_SAMPLES[Math.floor(Math.random() * FALLBACK_SAMPLES.length)],
    TRANSLATE_HANZI_LIMIT,
  );
}

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "reader-sample", LIMIT, WINDOW_MS);
  if (limited) return limited;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(JINRISHICI_URL, {
        headers: { "User-Agent": "shijie-reader/1.0" },
        cache: "no-store",
      });
      if (!res.ok) continue;

      const json = (await res.json()) as JinrishiciResponse;
      if (json.status !== "success" || !json.data) continue;

      const lines = json.data.origin?.content?.length
        ? json.data.origin.content
        : [json.data.content ?? ""];
      const raw = lines.join("").replace(/\s+/g, "");
      const text = trimToHanziLimit(raw, TRANSLATE_HANZI_LIMIT);

      if (countHanzi(text) < 8) continue;

      return NextResponse.json({
        text,
        source: json.data.origin?.title ?? null,
        author: json.data.origin?.author ?? null,
        dynasty: json.data.origin?.dynasty ?? null,
      });
    } catch {
      // try again or fall through to fallback
    }
  }

  return NextResponse.json({
    text: pickFallback(),
    source: null,
    author: null,
    dynasty: null,
    fallback: true,
  });
}
