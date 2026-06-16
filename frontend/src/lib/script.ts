import type { DictEntry, ScriptPreference } from "./types";

type OpenCCConverter = (text: string) => string;

let toTraditional: OpenCCConverter | null = null;
let toSimplified: OpenCCConverter | null = null;
let loading: Promise<void> | null = null;

function ensureTraditional(): OpenCCConverter {
  if (!toTraditional) {
    const { Converter } = require("opencc-js") as typeof import("opencc-js");
    toTraditional = Converter({ from: "cn", to: "tw" });
  }
  return toTraditional;
}

function ensureSimplified(): OpenCCConverter {
  if (!toSimplified) {
    const { Converter } = require("opencc-js") as typeof import("opencc-js");
    toSimplified = Converter({ from: "tw", to: "cn" });
  }
  return toSimplified;
}

async function ensureConverter(): Promise<void> {
  if (toTraditional && toSimplified) return;
  if (!loading) {
    loading = import("opencc-js").then(({ Converter }) => {
      toTraditional = Converter({ from: "cn", to: "tw" });
      toSimplified = Converter({ from: "tw", to: "cn" });
    });
  }
  await loading;
}

export type HanziForms = { simplified: string; traditional: string };

export function toSimplifiedSync(text: string): string {
  if (!text) return text;
  return ensureSimplified()(text);
}

export function toTraditionalSync(text: string): string {
  if (!text) return text;
  return ensureTraditional()(text);
}

export async function toPreferredScriptAsync(
  text: string,
  script: ScriptPreference,
): Promise<string> {
  if (!text) return text;
  await ensureConverter();
  return toPreferredScriptSync(text, script);
}

/** Convert text to the user's preferred script (both directions). */
export function toPreferredScriptSync(text: string, script: ScriptPreference): string {
  if (!text) return text;
  return script === "traditional" ? toTraditionalSync(text) : toSimplifiedSync(text);
}

export function hanziFormsFromText(text: string): HanziForms {
  if (!text) return { simplified: "", traditional: "" };
  return {
    simplified: toSimplifiedSync(text),
    traditional: toTraditionalSync(text),
  };
}

export function hanziFormsFromEntry(
  entry: Pick<DictEntry, "traditional" | "simplified">,
): HanziForms {
  return {
    simplified: entry.simplified || entry.traditional,
    traditional: entry.traditional || entry.simplified,
  };
}

export function hanziForScript(forms: HanziForms, script: ScriptPreference): string {
  return script === "traditional" ? forms.traditional : forms.simplified;
}

export function pickEntryForm(
  entry: Pick<DictEntry, "traditional" | "simplified">,
  script: ScriptPreference,
): string {
  return hanziForScript(hanziFormsFromEntry(entry), script);
}

/** Opposite script form for display (e.g. simplified under traditional headword). */
export function alternateScriptFormSync(text: string, script: ScriptPreference): string | null {
  if (!text) return null;
  const alt =
    script === "traditional" ? toSimplifiedSync(text) : toTraditionalSync(text);
  return alt !== text ? alt : null;
}

/** Fill in traditional when only simplified was stored (legacy rows). */
export function withTraditionalFallback(
  hanzi: string,
  hanziTraditional?: string | null,
): HanziForms {
  if (hanziTraditional) {
    return { simplified: hanzi, traditional: hanziTraditional };
  }
  return hanziFormsFromText(hanzi);
}
