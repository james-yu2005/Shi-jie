import type { ReaderAlignment } from "./types";

export type EnglishSegment = {
  text: string;
  /** token_index if this span is linked; undefined for unlinked text */
  tokenIndex?: number;
};

/**
 * Split English translation into linked and plain spans.
 * Multiple tokens may share the same span (many-to-one).
 * We deduplicate: the span is represented once, mapped to the
 * first token index that claims it.
 */
export function buildEnglishSegments(
  english: string,
  alignments: ReaderAlignment[],
): EnglishSegment[] {
  // collect non-filler alignments with valid spans, sorted by start
  const linked = alignments
    .filter((a) => !a.is_filler && a.english_start >= 0 && a.english_end > a.english_start)
    .sort((a, b) => a.english_start - b.english_start);

  // deduplicate spans: if two tokens share the same start/end, keep only the first
  const seen = new Set<string>();
  const deduped: ReaderAlignment[] = [];
  for (const a of linked) {
    const key = `${a.english_start}:${a.english_end}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }

  const segments: EnglishSegment[] = [];
  let pos = 0;

  for (const a of deduped) {
    if (a.english_start > pos) {
      segments.push({ text: english.slice(pos, a.english_start) });
    }
    segments.push({
      text: english.slice(a.english_start, a.english_end),
      tokenIndex: a.token_index,
    });
    pos = a.english_end;
  }

  if (pos < english.length) {
    segments.push({ text: english.slice(pos) });
  }

  if (segments.length === 0) {
    segments.push({ text: english });
  }

  return segments;
}

export type ActiveLink = {
  sentenceIdx: number;
  tokenIndex: number;
};

export function alignmentForToken(
  alignments: ReaderAlignment[],
  tokenIndex: number,
): ReaderAlignment | null {
  return alignments.find((x) => x.token_index === tokenIndex) ?? null;
}

export function isTokenHighlighted(
  alignments: ReaderAlignment[],
  tokenIndex: number,
  active: ActiveLink | null,
  sentenceIdx: number,
): boolean {
  if (!active || active.sentenceIdx !== sentenceIdx) return false;
  if (active.tokenIndex === tokenIndex) return true;

  // also highlight if the active token shares the same English span
  const activeA = alignments.find((a) => a.token_index === active.tokenIndex);
  const thisA = alignments.find((a) => a.token_index === tokenIndex);
  if (
    activeA && thisA &&
    activeA.english_start >= 0 &&
    activeA.english_start === thisA.english_start &&
    activeA.english_end === thisA.english_end
  ) {
    return true;
  }
  return false;
}

export function isSegmentHighlighted(
  tokenIndex: number | undefined,
  alignments: ReaderAlignment[],
  active: ActiveLink | null,
  sentenceIdx: number,
): boolean {
  if (tokenIndex === undefined || !active) return false;
  if (active.sentenceIdx !== sentenceIdx) return false;

  if (active.tokenIndex === tokenIndex) return true;

  // highlight if active token shares this English span
  const activeA = alignments.find((a) => a.token_index === active.tokenIndex);
  const thisA = alignments.find((a) => a.token_index === tokenIndex);
  if (
    activeA && thisA &&
    activeA.english_start >= 0 &&
    activeA.english_start === thisA.english_start &&
    activeA.english_end === thisA.english_end
  ) {
    return true;
  }
  return false;
}
