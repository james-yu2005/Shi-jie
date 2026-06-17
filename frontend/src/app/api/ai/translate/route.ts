import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { countHanzi, TRANSLATE_HANZI_LIMIT } from "@/lib/chinese";

const Body = z.object({
  text: z
    .string()
    .min(1)
    .refine((t) => countHanzi(t) <= TRANSLATE_HANZI_LIMIT, {
      message: `Maximum ${TRANSLATE_HANZI_LIMIT} Chinese characters`,
    }),
});

export async function POST(req: Request) {
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
