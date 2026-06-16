import type { ReaderReadResult, ReaderSentenceTranslation } from "./types";

type Token = ReaderReadResult["tokens"][number];

const SENT_END = /[。！？!?\n]$/;

/** Group token indices into sentences (matches backend translator logic). */
export function groupTokenIndices(tokens: Token[]): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    current.push(i);
    if (SENT_END.test(tokens[i].token) || tokens[i].token === "\n") {
      if (current.some((j) => tokens[j].is_hanzi)) groups.push(current);
      current = [];
    }
  }
  if (current.length && current.some((j) => tokens[j].is_hanzi)) {
    groups.push(current);
  }
  return groups;
}

export function sentenceGroupsFromResult(
  tokens: Token[],
  sentences: ReaderSentenceTranslation[],
): number[][] {
  if (sentences.length > 0) {
    return sentences.map((s) => s.token_indices);
  }
  return groupTokenIndices(tokens);
}

export function chineseForIndices(
  tokens: Token[],
  indices: number[],
  display: (text: string) => string,
): string {
  return indices.map((i) => display(tokens[i].token)).join("");
}
