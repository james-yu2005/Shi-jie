"use client";

import { useMemo } from "react";
import type { ReaderSentenceTranslation } from "@/lib/types";

const EN_WORD = /\S+/g;

type WordSpan = { word: string; index: number };

function englishWords(english: string): WordSpan[] {
  const out: WordSpan[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = EN_WORD.exec(english))) {
    out.push({ word: m[0], index: i++ });
  }
  return out;
}

type Props = {
  sentences: ReaderSentenceTranslation[];
  hoveredToken: number | null;
  hoveredEnglish: { sentenceIdx: number; wordIdx: number } | null;
  onHoverToken: (idx: number | null) => void;
  onHoverEnglish: (pos: { sentenceIdx: number; wordIdx: number } | null) => void;
};

export function ReaderTranslation({
  sentences,
  hoveredToken,
  hoveredEnglish,
  onHoverToken,
  onHoverEnglish,
}: Props) {
  const tokenToEnglish = useMemo(() => {
    const map = new Map<
      number,
      { gloss: string; wordIndices: Set<number>; sentenceIdx: number }
    >();
    sentences.forEach((sent, sentenceIdx) => {
      for (const a of sent.alignments) {
        map.set(a.token_index, {
          gloss: a.gloss,
          wordIndices: new Set(a.english_word_indices),
          sentenceIdx,
        });
      }
    });
    return map;
  }, [sentences]);

  const englishToToken = useMemo(() => {
    const map = new Map<string, number>();
    sentences.forEach((sent, sentenceIdx) => {
      for (const a of sent.alignments) {
        for (const wi of a.english_word_indices) {
          map.set(`${sentenceIdx}:${wi}`, a.token_index);
        }
      }
    });
    return map;
  }, [sentences]);

  const activeGloss = hoveredToken !== null ? tokenToEnglish.get(hoveredToken) : null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="label">English translation</span>
        <span className="text-xs text-ink/50">Hover Chinese or English to see connections</span>
      </div>

      {activeGloss && (
        <div className="reader-gloss">
          <span className="font-medium text-accent2">{activeGloss.gloss}</span>
          <span className="text-ink/50"> — linked words highlighted below</span>
        </div>
      )}

      <div className="space-y-4 text-base leading-relaxed text-ink/90">
        {sentences.map((sent, sentenceIdx) => {
          const words = englishWords(sent.english);
          const highlightIndices = new Set<number>();

          if (hoveredToken !== null) {
            const link = tokenToEnglish.get(hoveredToken);
            if (link?.sentenceIdx === sentenceIdx) {
              link.wordIndices.forEach((i) => highlightIndices.add(i));
            }
          }
          if (hoveredEnglish?.sentenceIdx === sentenceIdx) {
            highlightIndices.add(hoveredEnglish.wordIdx);
          }

          return (
            <p key={sentenceIdx}>
              {words.map(({ word, index }) => {
                const linkedToken = englishToToken.get(`${sentenceIdx}:${index}`);
                const isHighlight = highlightIndices.has(index);
                const isLinkedHover =
                  hoveredToken !== null &&
                  linkedToken === hoveredToken &&
                  tokenToEnglish.get(hoveredToken)?.sentenceIdx === sentenceIdx;

                return (
                  <span
                    key={index}
                    className="english-token"
                    data-link-hover={isHighlight || isLinkedHover ? "true" : undefined}
                    onMouseEnter={() => {
                      onHoverEnglish({ sentenceIdx, wordIdx: index });
                      if (linkedToken !== undefined) onHoverToken(linkedToken);
                    }}
                    onMouseLeave={() => {
                      onHoverEnglish(null);
                      onHoverToken(null);
                    }}
                  >
                    {word}{" "}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function buildTokenLinkMap(sentences: ReaderSentenceTranslation[]) {
  const englishToToken = new Map<string, number>();
  const tokenToEnglish = new Map<number, Set<number>>();

  sentences.forEach((sent, sentenceIdx) => {
    for (const a of sent.alignments) {
      const set = tokenToEnglish.get(a.token_index) ?? new Set<number>();
      for (const wi of a.english_word_indices) {
        set.add(wi);
        englishToToken.set(`${sentenceIdx}:${wi}`, a.token_index);
      }
      tokenToEnglish.set(a.token_index, set);
    }
  });

  return { englishToToken, tokenToEnglish };
}
