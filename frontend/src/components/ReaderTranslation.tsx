"use client";

import type { ReaderReadResult, ReaderSentenceTranslation } from "@/lib/types";
import {
  alignmentForToken,
  buildEnglishSegments,
  isSegmentHighlighted,
  type ActiveLink,
} from "@/lib/reader-alignment";
import { resolveWordPanelGloss } from "@/lib/word-gloss";

type Token = ReaderReadResult["tokens"][number];

type SentenceEnglishProps = {
  sent: ReaderSentenceTranslation;
  sentenceIdx: number;
  activeLink: ActiveLink | null;
  onActivateLink: (link: ActiveLink | null) => void;
};

export function TranslationSentence({
  sent,
  sentenceIdx,
  activeLink,
  onActivateLink,
}: SentenceEnglishProps) {
  const segments = buildEnglishSegments(sent.english, sent.alignments);

  return (
    <p className="text-sm leading-relaxed text-ink/80 border-t border-ink/10 pt-2 mt-1">
      {segments.map((seg, i) => {
        if (seg.tokenIndex === undefined) {
          return <span key={i}>{seg.text}</span>;
        }
        const highlighted = isSegmentHighlighted(
          seg.tokenIndex,
          sent.alignments,
          activeLink,
          sentenceIdx,
        );
        return (
          <span
            key={i}
            className="english-token"
            data-link-hover={highlighted ? "true" : undefined}
            onMouseEnter={() =>
              onActivateLink({ sentenceIdx, tokenIndex: seg.tokenIndex! })
            }
          >
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}

type GlossBarProps = {
  sentences: ReaderSentenceTranslation[];
  tokens: Token[];
  activeLink: ActiveLink | null;
};

/** Badge shown at the bottom of the hovered token — gloss for all tokens, grammar label for fillers. */
export function TokenGlossBadge({ sentences, tokens, activeLink }: GlossBarProps) {
  if (!activeLink) return null;

  const sent = sentences[activeLink.sentenceIdx];
  if (!sent) return null;

  const alignment = alignmentForToken(sent.alignments, activeLink.tokenIndex);
  if (!alignment) return null;

  const tok = tokens[activeLink.tokenIndex];
  const isFiller = alignment.is_filler;
  const gloss =
    isFiller || !tok?.entries.length
      ? alignment.gloss
      : resolveWordPanelGloss(tok, alignment.gloss);
  const phrase = alignment.english_phrase;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm ${
      isFiller
        ? "bg-amber-50 border border-amber-200 text-amber-800"
        : "bg-accent2/5 border border-accent2/20 text-ink/80"
    }`}>
      {isFiller ? (
        <>
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Grammar
          </span>
          <span className="font-medium">{gloss}</span>
        </>
      ) : (
        <>
          <span className="font-medium text-accent2">{gloss}</span>
          {phrase && (
            <span className="text-ink/50">
              → <span className="italic">{phrase}</span>
            </span>
          )}
        </>
      )}
    </div>
  );
}
