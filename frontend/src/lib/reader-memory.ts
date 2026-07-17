import type { ReaderReadResult } from "./types";

const MEMORY_KEY = "shijie-reader-memory";
export const READER_MEMORY_LIMIT = 5;

export type SavedReaderSentence = {
  id: string;
  chinese: string;
  english: string;
  savedAt: number;
  readResult: ReaderReadResult;
};

export function loadReaderMemory(): SavedReaderSentence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedSentence)
      .slice(0, READER_MEMORY_LIMIT);
  } catch {
    return [];
  }
}

function isSavedSentence(value: unknown): value is SavedReaderSentence {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SavedReaderSentence>;
  return (
    typeof v.id === "string" &&
    typeof v.chinese === "string" &&
    typeof v.english === "string" &&
    typeof v.savedAt === "number" &&
    Boolean(v.readResult) &&
    Array.isArray(v.readResult?.tokens)
  );
}

export function saveReaderMemory(items: SavedReaderSentence[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify(items.slice(0, READER_MEMORY_LIMIT)),
    );
  } catch {
    // quota / private mode — ignore
  }
}

/** Build a single-sentence ReaderReadResult with remapped token indices. */
export function sliceSentenceResult(
  result: ReaderReadResult,
  sentenceIdx: number,
  tokenIndices: number[],
): ReaderReadResult | null {
  if (!tokenIndices.length) return null;
  const indexMap = new Map(tokenIndices.map((old, next) => [old, next]));
  const tokens = tokenIndices.map((i) => result.tokens[i]).filter(Boolean);
  if (!tokens.length) return null;

  const sent = result.sentences[sentenceIdx];
  if (!sent) {
    return { tokens, sentences: [] };
  }

  return {
    tokens,
    sentences: [
      {
        token_indices: tokenIndices.map((_, i) => i),
        english: sent.english,
        alignments: sent.alignments
          .filter((a) => indexMap.has(a.token_index))
          .map((a) => ({
            ...a,
            token_index: indexMap.get(a.token_index)!,
          })),
      },
    ],
  };
}

export function findSavedSentence(
  items: SavedReaderSentence[],
  chinese: string,
  english: string,
): SavedReaderSentence | undefined {
  return items.find((s) => s.chinese === chinese && s.english === english);
}

export function addSavedSentence(
  items: SavedReaderSentence[],
  entry: Omit<SavedReaderSentence, "id" | "savedAt">,
): { items: SavedReaderSentence[]; ok: boolean; reason?: "duplicate" | "full" } {
  if (findSavedSentence(items, entry.chinese, entry.english)) {
    return { items, ok: false, reason: "duplicate" };
  }
  if (items.length >= READER_MEMORY_LIMIT) {
    return { items, ok: false, reason: "full" };
  }
  const next: SavedReaderSentence = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  return { items: [next, ...items], ok: true };
}

export function removeSavedSentence(
  items: SavedReaderSentence[],
  id: string,
): SavedReaderSentence[] {
  return items.filter((s) => s.id !== id);
}
