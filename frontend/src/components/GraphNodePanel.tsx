"use client";
import { useCallback, useEffect, useState } from "react";
import type { DictLookup, KgEdge, KgNode, KgSuggestion } from "@/lib/types";

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

  const playAudio = useCallback(() => {
    if (!node) return;
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=${encodeURIComponent(node.hanzi)}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(node.hanzi);
        u.lang = "zh-CN";
        u.rate = 0.85;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    });
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
        <div>
          <div className="flex items-center gap-2">
            <div className="hanzi text-3xl font-bold leading-tight">
              {node.hanzi}
            </div>
            <button
              className="btn-outline shrink-0 px-2 py-1 text-sm"
              onClick={playAudio}
              aria-label="Play pronunciation"
            >
              🔊
            </button>
          </div>
          {!lookup?.entries?.length && node.pinyin && (
            <div className="text-sm text-ink/70">{node.pinyin}</div>
          )}
        </div>
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
        {!lookupLoading && lookup && lookup.entries.length > 0 ? (
          <ul className="space-y-2">
            {lookup.entries.slice(0, 1).map((e, i) => (
              <li key={i} className="text-sm">
                <div className="text-ink/70">{e.pinyin}</div>
                <ol className="mt-1 list-decimal pl-5">
                  {e.definitions.slice(0, 3).map((d, j) => (
                    <li key={j}>{d}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
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
                {c}
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
              <div className="hanzi text-2xl">{s.hanzi}</div>
              <div className="flex-1 text-sm">
                <div className="text-ink/70">{s.pinyin}</div>
                <div>{s.definition}</div>
                <div className="text-xs text-ink/60">{s.reason}</div>
              </div>
              <button
                className="btn-outline"
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
      <ul className="space-y-1">
        {items.map(({ edge, other }) => (
          <li key={edge.id}>
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-ink/5"
              onClick={() => onSelect(other.id)}
            >
              <span className="hanzi text-lg">{other.hanzi}</span>
              <span className="text-xs text-ink/60">{other.pinyin}</span>
              <span className="ml-auto text-xs text-ink/60">{edge.reason}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
