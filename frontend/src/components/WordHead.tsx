"use client";

import type { DictEntry } from "@/lib/types";
import { resolveWordForms } from "@/lib/word-display";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";

type Size = "xs" | "sm" | "md" | "lg";

const hanziSize: Record<Size, string> = {
  xs: "text-lg",
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
};

type Props = {
  hanzi: string;
  hanziTraditional?: string | null;
  entry?: Pick<
    DictEntry,
    "traditional" | "simplified" | "pinyin" | "pinyin_numbered" | "jyutping"
  > | null;
  pinyin?: string | null;
  jyutping?: string | null;
  size?: Size;
  showAudio?: boolean;
  showAltScript?: boolean;
  /** Pinyin and jyutping on one line (used in compact lists). */
  inlineRomanization?: boolean;
  className?: string;
};

export function RomanizationLines({
  pinyin,
  jyutping,
  compact = false,
  inline = false,
  className = "",
}: {
  pinyin: string;
  jyutping: string;
  compact?: boolean;
  /** Single line — good for compact mobile lists. */
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    const parts = [pinyin, jyutping].filter(Boolean);
    if (!parts.length) return null;
    return (
      <div className={`truncate text-xs text-ink/60 ${className}`}>{parts.join(" · ")}</div>
    );
  }
  const text = compact ? "text-xs" : "text-sm";
  return (
    <div className={`space-y-0.5 ${text} ${className}`}>
      <div className="text-ink/70">
        <span className="text-ink/50">Pinyin:</span> {pinyin || "—"}
      </div>
      <div className="text-ink/70">
        <span className="text-ink/50">Jyutping:</span> {jyutping || "—"}
      </div>
    </div>
  );
}

export function WordHead({
  hanzi,
  hanziTraditional,
  entry,
  pinyin,
  jyutping,
  size = "md",
  showAudio = false,
  showAltScript = true,
  inlineRomanization = false,
  className = "",
}: Props) {
  const { preferences, playAudio } = useLearningPreferences();
  const { primary, alt, pinyin: pin, jyutping: jyut } = resolveWordForms(
    hanzi,
    preferences.script,
    entry,
    { pinyin, jyutping, hanziTraditional },
  );
  const headword = primary;

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <div>
          <div className={`hanzi font-bold leading-tight ${hanziSize[size]}`}>
            {headword}
          </div>
          {showAltScript && alt && <div className="text-sm text-ink/50">{alt}</div>}
        </div>
        {showAudio && (
          <button
            type="button"
            className="btn-outline shrink-0"
            onClick={() => playAudio(headword)}
            aria-label="Play pronunciation"
          >
            🔊
          </button>
        )}
      </div>
      <RomanizationLines
        pinyin={pin}
        jyutping={jyut}
        compact={size === "sm" || size === "xs"}
        inline={inlineRomanization}
        className="mt-0.5"
      />
    </div>
  );
}
