import { NextResponse } from "next/server";
import { z } from "zod";
import { backendFetch } from "@/lib/backend";
import { withAuth } from "@/lib/auth";
import { backendLearningPrefs, getUserPreferences } from "@/lib/preferences";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({
  word: z.string().min(1),
  context: z.string().optional().nullable(),
});

const LIMIT = 30;
const WINDOW_MS = 15 * 60 * 1000;

export const POST = withAuth(async (user, req) => {
  const limited = enforceRateLimit(req, "ai-explain", LIMIT, WINDOW_MS, user.id);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const prefs = await getUserPreferences(user.id);
  try {
    const data = await backendFetch("/ai/explain", {
      method: "POST",
      json: { ...parsed.data, ...backendLearningPrefs(prefs) },
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
});
