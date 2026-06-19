const HANZI_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

export const TRANSLATE_HANZI_LIMIT = 100;

export function countHanzi(text: string): number {
  return (text.match(HANZI_RE) ?? []).length;
}

const HANZI_CHAR_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const SENTENCE_END_RE = /[。！？；\n]/;

/** Trim text to at most `limit` hanzi, preferring to end on a sentence boundary. */
export function trimToHanziLimit(text: string, limit: number): string {
  let hanzi = 0;
  let lastBreak = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (HANZI_CHAR_RE.test(ch)) hanzi += 1;
    if (SENTENCE_END_RE.test(ch)) lastBreak = i;
    if (hanzi > limit) {
      if (lastBreak > 0) return text.slice(0, lastBreak + 1).trim();
      return text.slice(0, i).trim();
    }
  }
  return text.trim();
}
