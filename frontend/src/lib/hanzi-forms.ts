import { backendFetch } from "./backend";
import type { DictLookup } from "./types";
import {
  hanziFormsFromEntry,
  hanziFormsFromText,
  type HanziForms,
} from "./script";

export type { HanziForms };

/** Resolve both script forms via CEDICT when possible, else OpenCC. */
export async function resolveHanziForms(hanzi: string): Promise<HanziForms> {
  const trimmed = hanzi.trim();
  if (!trimmed) return { simplified: "", traditional: "" };

  try {
    const data = await backendFetch<DictLookup>(
      `/dictionary/lookup?word=${encodeURIComponent(trimmed)}`,
    );
    const entry = data.entries[0];
    if (entry) return hanziFormsFromEntry(entry);
  } catch {
    // dictionary offline — fall back to OpenCC
  }

  return hanziFormsFromText(trimmed);
}
