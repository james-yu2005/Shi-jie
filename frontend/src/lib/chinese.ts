const HANZI_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

export const TRANSLATE_HANZI_LIMIT = 75;

export function countHanzi(text: string): number {
  return (text.match(HANZI_RE) ?? []).length;
}
