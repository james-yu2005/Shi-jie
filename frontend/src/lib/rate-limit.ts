import { NextResponse } from "next/server";

type Entry = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Entry>>();

function getStore(namespace: string): Map<string, Entry> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const store = getStore(namespace);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Apply IP-based rate limiting; returns a 429 response when exceeded. */
export function enforceRateLimit(
  req: Request,
  namespace: string,
  limit: number,
  windowMs: number,
  key?: string,
): NextResponse | null {
  const result = checkRateLimit(namespace, key ?? clientIp(req), limit, windowMs);
  if (!result.ok) return rateLimitResponse(result.retryAfter);
  return null;
}
