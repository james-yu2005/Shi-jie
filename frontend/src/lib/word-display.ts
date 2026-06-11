import type { DictEntry, ScriptPreference } from "./types";
import { alternateScriptFormSync } from "./script";

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
  stored?: { pinyin?: string | null; jyutping?: string | null },
) {
  const primary = entry
    ? script === "traditional"
      ? entry.traditional || entry.simplified
      : entry.simplified || entry.traditional
    : hanzi;

  const alt = entry
    ? altFormFromEntry(entry, script)
    : alternateScriptFormSync(hanzi, script);

  const pinyin = entry ? pinyinFromEntry(entry) : stored?.pinyin || "";
  const jyutping = entry ? jyutpingFromEntry(entry) : stored?.jyutping || "";

  return { primary, alt, pinyin, jyutping };
}
