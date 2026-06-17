import type { ReaderReadResult } from "@/lib/types";

type Token = ReaderReadResult["tokens"][number];

export function wordPanelDefinitions(tok: Token): string[] {
  return tok.entries.flatMap((e) => e.definitions ?? []);
}

/** Pick a gloss that appears in WordPanel's definition list. */
export function resolveWordPanelGloss(tok: Token, preferred?: string): string {
  const defs = wordPanelDefinitions(tok);
  if (!defs.length) return preferred?.trim() ?? "";
  if (!preferred?.trim()) return defs[0];

  const p = preferred.trim().toLowerCase();
  const exact = defs.find((d) => d.toLowerCase() === p);
  if (exact) return exact;

  const sense = defs.find((d) => {
    const short = d.split(";")[0].split("(")[0].trim().toLowerCase();
    return short === p || d.toLowerCase().includes(p) || p.includes(short);
  });
  return sense ?? defs[0];
}
