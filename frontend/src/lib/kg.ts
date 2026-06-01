// Shared helpers for the knowledge-graph routes and UI.
import type { KgEdge, KgEdgeType, KgNode } from "./types";

/** A Prisma KgNode row (the fields we read), mapped to the client shape. */
export function nodeToClient(n: {
  id: string;
  hanzi: string;
  pinyin: string;
  definition: string;
  radicals: unknown;
  components: unknown;
  semanticTags: unknown;
  notes: string | null;
  createdAt: Date;
}): KgNode {
  return {
    id: n.id,
    hanzi: n.hanzi,
    pinyin: n.pinyin,
    definition: n.definition,
    radicals: asStringArray(n.radicals),
    components: asStringArray(n.components),
    semanticTags: asStringArray(n.semanticTags),
    notes: n.notes,
    createdAt: n.createdAt.toISOString(),
  };
}

/** A Prisma KgEdge row, mapped to the client shape. */
export function edgeToClient(e: {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  reason: string;
  weight: number;
}): KgEdge {
  return {
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    type: (e.type === "character" ? "character" : "meaning") as KgEdgeType,
    reason: e.reason,
    weight: e.weight,
  };
}

export type AnalyzedWord = {
  pinyin: string;
  definition: string;
  radicals: string[];
  components: string[];
  semanticTags: string[];
};

export type DerivedEdge = {
  type: KgEdgeType;
  sourceId: string;
  targetId: string;
  reason: string;
  weight: number;
  /** raw shared tokens, used so the caller can build readable reasons */
  shared: string[];
};

/** Deterministically derive edges between a new node and the rest of the graph. */
export function deriveEdges(
  newNode: Pick<KgNode, "id" | "hanzi" | "radicals" | "semanticTags">,
  others: Pick<KgNode, "id" | "hanzi" | "radicals" | "semanticTags">[],
): DerivedEdge[] {
  const out: DerivedEdge[] = [];
  for (const other of others) {
    if (other.id === newNode.id) continue;

    const sharedR = newNode.radicals.filter((r) => other.radicals.includes(r));
    if (sharedR.length > 0) {
      out.push({
        type: "character",
        sourceId: newNode.id,
        targetId: other.id,
        reason: `Share radical ${sharedR.join(" · ")}`,
        weight: sharedR.length,
        shared: sharedR,
      });
    }

    const sharedT = newNode.semanticTags.filter((t) =>
      other.semanticTags.includes(t),
    );
    if (sharedT.length > 0) {
      out.push({
        type: "meaning",
        sourceId: newNode.id,
        targetId: other.id,
        reason: `Both relate to ${sharedT.join(", ")}`,
        weight: sharedT.length,
        shared: sharedT,
      });
    }
  }
  return out;
}

/** Coerce a Prisma Json column to a string[] safely. */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
