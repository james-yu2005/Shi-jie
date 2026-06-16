"use client";

import { useCallback, useEffect, useState } from "react";
import type { DictLookup, KgEdge, KgNode, KgSuggestion } from "@/lib/types";
import { WordHead } from "./WordHead";
import { Hanzi } from "./Hanzi";

type Props = {
  node: KgNode | null;
  allNodes: KgNode[];
  edges: KgEdge[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onAddSuggestion: (hanzi: string) => Promise<void>;
};

export function GraphNodePanel({
  node,
  allNodes,
  edges,
  onClose,
  onDelete,
  onSelect,
  onAddSuggestion,
}: Props) {
  const [suggestions, setSuggestions] = useState<KgSuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addingHanzi, setAddingHanzi] = useState<string | null>(null);
  const [lookup, setLookup] = useState<DictLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    setSuggestError(null);
    setLookup(null);
    if (!node) return;
    let cancelled = false;
    setLookupLoading(true);
    fetch(`/api/dictionary/lookup?word=${encodeURIComponent(node.hanzi)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DictLookup;
      })
      .then((d) => {
        if (!cancelled) setLookup(d);
      })
      .catch(() => {
        if (!cancelled) setLookup(null);
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node]);

  const fetchSuggestions = useCallback(async () => {
    if (!node) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const r = await fetch("/api/kg/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focusId: node.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSuggestions(j.suggestions as KgSuggestion[]);
    } catch (e) {
      setSuggestError(String(e));
    } finally {
      setSuggestLoading(false);
    }
  }, [node]);

  if (!node) {
    return (
      <div className="card text-sm text-ink/60">
        <div className="label mb-2">Node detail</div>
        Click any node in the knowledge graph to see its breakdown, neighbours, and
        suggested new connections.
      </div>
    );
  }

  const primaryEntry = lookup?.entries[0];
  const neighbors = edges
    .filter((e) => e.sourceId === node.id || e.targetId === node.id)
    .map((e) => {
      const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
      const other = allNodes.find((n) => n.id === otherId);
      return { edge: e, other };
    })
    .filter((n): n is { edge: KgEdge; other: KgNode } => Boolean(n.other));

  const meaningNeighbors = neighbors.filter((n) => n.edge.type === "meaning");
  const charNeighbors = neighbors.filter((n) => n.edge.type === "character");

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <WordHead
          hanzi={node.hanzi}
          hanziTraditional={node.hanziTraditional}
          entry={primaryEntry}
          pinyin={node.pinyin}
          jyutping={node.jyutping}
          showAudio
        />
        <button
          onClick={onClose}
          className="text-ink/40 hover:text-ink"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div>
        <div className="label mb-1">Definition</div>
        {lookupLoading && (
          <div className="text-sm text-ink/60">Loading…</div>
        )}
        {!lookupLoading && primaryEntry ? (
          <ol className="list-decimal pl-5 text-sm">
            {primaryEntry.definitions.slice(0, 3).map((d, j) => (
              <li key={j}>{d}</li>
            ))}
          </ol>
        ) : (
          !lookupLoading && (
            <div className="text-sm text-ink/60">
              {node.definition || "No dictionary entry found."}
            </div>
          )
        )}
      </div>

      {node.components.length > 0 && (
        <div>
          <div className="label mb-1">Components</div>
          <ul className="space-y-1 text-sm">
            {node.components.map((c, i) => (
              <li key={i} className="hanzi text-sm">
                <Hanzi text={c} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {neighbors.length === 0 ? (
        <div className="text-sm text-ink/60">
          No edges yet. Add more words and they&apos;ll auto-link by radical or
          meaning.
        </div>
      ) : (
        <>
          {charNeighbors.length > 0 && (
            <NeighborList
              color="#c0392b"
              label="Character"
              items={charNeighbors}
              onSelect={onSelect}
            />
          )}
          {meaningNeighbors.length > 0 && (
            <NeighborList
              color="#2c7da0"
              label="Meaning"
              items={meaningNeighbors}
              onSelect={onSelect}
            />
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
        <button
          className="btn-outline"
          onClick={fetchSuggestions}
          disabled={suggestLoading}
        >
          {suggestLoading ? "Thinking…" : "✨ Suggest related"}
        </button>
        <button
          className="btn-outline text-red-600"
          onClick={() => onDelete(node.id)}
        >
          Remove node
        </button>
      </div>

      {suggestError && (
        <div className="text-sm text-red-600">{suggestError}</div>
      )}

      {suggestions && suggestions.length === 0 && (
        <div className="text-sm text-ink/60">
          No new suggestions right now.
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="label">Suggested additions</div>
          {suggestions.map((s) => (
            <div
              key={s.hanzi}
              className="flex items-start gap-2 rounded-md border border-ink/10 bg-paper p-2"
            >
              <WordHead hanzi={s.hanzi} pinyin={s.pinyin} size="sm" className="min-w-0 flex-1" />
              <div className="flex-1 text-sm">
                <div>{s.definition}</div>
                <div className="text-xs text-ink/60">{s.reason}</div>
              </div>
              <button
                className="btn-outline shrink-0"
                disabled={addingHanzi === s.hanzi}
                onClick={async () => {
                  setAddingHanzi(s.hanzi);
                  await onAddSuggestion(s.hanzi);
                  setAddingHanzi(null);
                }}
              >
                {addingHanzi === s.hanzi ? "Adding…" : "+ Add"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NeighborList({
  color,
  label,
  items,
  onSelect,
}: {
  color: string;
  label: string;
  items: { edge: KgEdge; other: KgNode }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label} ({items.length})
      </div>
      <ul className="space-y-2">
        {items.map(({ edge, other }) => (
          <li key={edge.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-1 rounded-md px-2 py-1 text-left hover:bg-ink/5"
              onClick={() => onSelect(other.id)}
            >
              <WordHead
                hanzi={other.hanzi}
                hanziTraditional={other.hanziTraditional}
                pinyin={other.pinyin}
                jyutping={other.jyutping}
                size="sm"
              />
              <span className="text-xs text-ink/60">{edge.reason}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
