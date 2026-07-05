import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { countHanzi, TRANSLATE_HANZI_LIMIT } from "@/lib/chinese";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({
  text: z
    .string()
    .min(1)
    .refine((t) => countHanzi(t) <= TRANSLATE_HANZI_LIMIT, {
      message: `Maximum ${TRANSLATE_HANZI_LIMIT} Chinese characters`,
    }),
});

const GUEST_LIMIT = 20;
const AUTH_LIMIT = 60;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  const limited = enforceRateLimit(
    req,
    "ai-translate",
    user ? AUTH_LIMIT : GUEST_LIMIT,
    WINDOW_MS,
    user?.id ?? clientIp(req),
  );
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
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
