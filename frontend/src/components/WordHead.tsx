"use client";

import type { DictEntry } from "@/lib/types";
import { resolveWordForms } from "@/lib/word-display";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";

type Size = "sm" | "md" | "lg";

const hanziSize: Record<Size, string> = {
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
  className?: string;
};

export function RomanizationLines({
  pinyin,
  jyutping,
  compact = false,
  className = "",
}: {
  pinyin: string;
  jyutping: string;
  compact?: boolean;
  className?: string;
}) {
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
            className="btn-outline shrink-0 px-2 py-1 text-sm"
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
        compact={size === "sm"}
        className="mt-1"
      />
    </div>
  );
}
