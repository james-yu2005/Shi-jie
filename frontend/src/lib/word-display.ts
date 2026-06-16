import type { DictEntry, ScriptPreference } from "./types";
import {
  alternateScriptFormSync,
  hanziForScript,
  hanziFormsFromText,
  withTraditionalFallback,
  type HanziForms,
} from "./script";

export function pinyinFromEntry(entry: Pick<DictEntry, "pinyin" | "pinyin_numbered">): string {
  return entry.pinyin || entry.pinyin_numbered || "";
}

export function jyutpingFromEntry(entry: Pick<DictEntry, "jyutping">): string {
  return entry.jyutping || "";
}

export function altFormFromEntry(
  entry: Pick<DictEntry, "traditional" | "simplified">,
  script: ScriptPreference,
): string | null {
  if (entry.traditional === entry.simplified) return null;
  return script === "traditional" ? entry.simplified : entry.traditional;
}

export function resolveWordForms(
  hanzi: string,
  script: ScriptPreference,
  entry?: Pick<DictEntry, "traditional" | "simplified" | "pinyin" | "pinyin_numbered" | "jyutping"> | null,
  stored?: {
    pinyin?: string | null;
    jyutping?: string | null;
    hanziTraditional?: string | null;
  },
) {
  let forms: HanziForms;
  if (entry) {
    forms = {
      simplified: entry.simplified || entry.traditional,
      traditional: entry.traditional || entry.simplified,
    };
  } else {
    forms = withTraditionalFallback(hanzi, stored?.hanziTraditional);
  }

  const primary = hanziForScript(forms, script);
  const alt =
    forms.simplified !== forms.traditional
      ? script === "traditional"
        ? forms.simplified
        : forms.traditional
      : entry
        ? altFormFromEntry(entry, script)
        : alternateScriptFormSync(hanzi, script);

  const pinyin = entry ? pinyinFromEntry(entry) : stored?.pinyin || "";
  const jyutping = entry ? jyutpingFromEntry(entry) : stored?.jyutping || "";

  return { primary, alt, pinyin, jyutping, forms };
}

/** Display a stored word in the user's preferred script. */
export function displayStoredHanzi(
  hanzi: string,
  script: ScriptPreference,
  hanziTraditional?: string | null,
): string {
  return hanziForScript(withTraditionalFallback(hanzi, hanziTraditional), script);
}

/** Convert free-form Chinese text (AI feedback, paragraphs, etc.). */
export function displayChineseText(text: string, script: ScriptPreference): string {
  if (!text) return text;
  return script === "traditional"
    ? hanziFormsFromText(text).traditional
    : hanziFormsFromText(text).simplified;
}
