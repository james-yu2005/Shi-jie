import type { DictEntry, ScriptPreference } from "./types";

type OpenCCConverter = (text: string) => string;

let toTraditional: OpenCCConverter | null = null;
let loading: Promise<void> | null = null;

async function ensureConverter(): Promise<OpenCCConverter> {
  if (toTraditional) return toTraditional;
  if (!loading) {
    loading = import("opencc-js").then(({ Converter }) => {
      toTraditional = Converter({ from: "cn", to: "tw" });
    });
  }
  await loading;
  return toTraditional!;
}

export async function toPreferredScriptAsync(
  text: string,
  script: ScriptPreference,
): Promise<string> {
  if (!text || script === "simplified") return text;
  const converter = await ensureConverter();
  return converter(text);
}

export function toPreferredScriptSync(text: string, script: ScriptPreference): string {
  if (!text || script === "simplified") return text;
  if (!toTraditional) {
    // Sync init on first call (opencc-js Converter returns a function).
    const { Converter } = require("opencc-js") as typeof import("opencc-js");
    toTraditional = Converter({ from: "cn", to: "tw" });
  }
  return toTraditional(text);
}

export function pickEntryForm(
  entry: Pick<DictEntry, "traditional" | "simplified">,
  script: ScriptPreference,
): string {
  if (script === "traditional") {
    return entry.traditional || entry.simplified;
  }
  return entry.simplified || entry.traditional;
}

let toSimplified: OpenCCConverter | null = null;

/** Opposite script form for display (e.g. simplified under traditional headword). */
export function alternateScriptFormSync(text: string, script: ScriptPreference): string | null {
  if (!text) return null;
  if (script === "traditional") {
    if (!toSimplified) {
      const { Converter } = require("opencc-js") as typeof import("opencc-js");
      toSimplified = Converter({ from: "tw", to: "cn" });
    }
    const alt = toSimplified(text);
    return alt !== text ? alt : null;
  }
  const alt = toPreferredScriptSync(text, "traditional");
  return alt !== text ? alt : null;
}
