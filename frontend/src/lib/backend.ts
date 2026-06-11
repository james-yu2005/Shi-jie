// Thin server-side helper for talking to the Python backend.
import type { UserPreferences } from "./types";
import { backendLearningPrefs } from "./preferences";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";
const SHARED_SECRET = process.env.BACKEND_SHARED_SECRET;

export async function backendFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("content-type", "application/json");
  if (SHARED_SECRET) headers.set("x-backend-secret", SHARED_SECRET);
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j === "string" ? j : JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`backend ${path} ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const BACKEND_URL = BACKEND;

/** Generate one Chinese paragraph from a word list (shared by paragraph + KG-sentence routes). */
export function generateParagraph(
  words: string[],
  prefs: UserPreferences,
): Promise<{ paragraph: string }> {
  return backendFetch<{ paragraph: string }>("/ai/paragraph", {
    method: "POST",
    json: { words, ...backendLearningPrefs(prefs) },
  });
}
