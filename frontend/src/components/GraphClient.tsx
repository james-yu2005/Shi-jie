"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KgEdge, KgNode } from "@/lib/types";
import { apiJson } from "@/lib/api";
import { markFirstWorldStep } from "@/lib/first-world";
import { GraphCanvas } from "./GraphCanvas";
import { GraphNodePanel } from "./GraphNodePanel";
import { GraphQuiz } from "./GraphQuiz";
import { GraphSentence } from "./GraphSentence";
import { GraphStats } from "./GraphStats";
import { MobileSheet } from "./MobileSheet";
import { ModeTabs } from "./ModeTabs";
import { PageHeader } from "./PageHeader";

type Mode = "explore" | "quiz" | "sentence";

type Props = {
  initialNodes: KgNode[];
  initialEdges: KgEdge[];
};

type AddResponse = {
  node: KgNode;
  edges: KgEdge[];
  newEdges?: KgEdge[];
  created: boolean;
};

export function GraphClient({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes] = useState<KgNode[]>(initialNodes);
  const [edges, setEdges] = useState<KgEdge[]>(initialEdges);
  const [mode, setMode] = useState<Mode>("explore");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ meaning: true, character: true });
  const [addHanzi, setAddHanzi] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [bloomEdgeIds, setBloomEdgeIds] = useState<string[]>([]);
  const bloomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBloom = useCallback(
    (newEdges: KgEdge[]) => {
      if (newEdges.length === 0) return;
      if (bloomTimer.current) clearTimeout(bloomTimer.current);
      setBloomEdgeIds(newEdges.map((e) => e.id));
      bloomTimer.current = setTimeout(() => {
        setBloomEdgeIds([]);
      }, 2800);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (bloomTimer.current) clearTimeout(bloomTimer.current);
    };
  }, []);

  const mergeAddResponse = useCallback(
    (data: AddResponse) => {
      setNodes((curr) => {
        if (curr.some((n) => n.id === data.node.id)) return curr;
        return [...curr, data.node];
      });
      setEdges((curr) => {
        const existingIds = new Set(curr.map((e) => e.id));
        const additions = data.edges.filter((e) => !existingIds.has(e.id));
        return additions.length === 0 ? curr : [...curr, ...additions];
      });
    },
    [],
  );

  const addWord = useCallback(
    async (hanzi: string) => {
      const trimmed = hanzi.trim();
      if (!trimmed) return;
      setAdding(true);
      setAddError(null);
      try {
        const j = await apiJson<AddResponse>("/api/kg", {
          method: "POST",
          json: { hanzi: trimmed },
        });
        mergeAddResponse(j);
        setSelectedId(j.node.id);
        if (j.created) markFirstWorldStep("graph");
        const fresh = j.newEdges ?? [];
        if (fresh.length > 0) {
          triggerBloom(fresh);
        }
      } catch (e) {
        setAddError(String(e));
      } finally {
        setAdding(false);
      }
    },
    [mergeAddResponse, triggerBloom],
  );

  const onAddFromInput = useCallback(async () => {
    await addWord(addHanzi);
    setAddHanzi("");
  }, [addHanzi, addWord]);

  const deleteNode = useCallback(
    async (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      if (!confirm(`Remove ${node.hanzi} from your knowledge graph?`)) return;
      const r = await fetch(`/api/kg/${id}`, { method: "DELETE" });
      if (!r.ok) return;
      setNodes((curr) => curr.filter((n) => n.id !== id));
      setEdges((curr) =>
        curr.filter((e) => e.sourceId !== id && e.targetId !== id),
      );
      if (selectedId === id) setSelectedId(null);
    },
    [nodes, selectedId],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const rebuild = useCallback(async () => {
    if (nodes.length === 0) return;
    if (
      !confirm(
        "Re-analyse every node and recompute edges? Takes a few seconds per word.",
      )
    )
      return;
    setRebuilding(true);
    setRebuildMsg(null);
    try {
      const j = await apiJson<{ nodesUpdated: number; edgesCreated: number }>(
        "/api/kg/rebuild",
        { method: "POST" },
      );
      const data = await apiJson<{ nodes: KgNode[]; edges: KgEdge[] }>(
        "/api/kg",
      );
      setNodes(data.nodes);
      setEdges(data.edges);
      setRebuildMsg(
        `Updated ${j.nodesUpdated} node(s) · ${j.edgesCreated} edge(s).`,
      );
    } catch (e) {
      setRebuildMsg(`Rebuild failed: ${e}`);
    } finally {
      setRebuilding(false);
    }
  }, [nodes.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Graph"
        subtitle="Every word you add becomes a node. Edges form automatically when two nodes share a radical (character) or a semantic tag (meaning)."
        meta={
          <>
            {nodes.length} node{nodes.length === 1 ? "" : "s"} ·{" "}
            {edges.length} edge{edges.length === 1 ? "" : "s"}
          </>
        }
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto">
            <button
              className="btn-outline w-full sm:w-auto"
              onClick={rebuild}
              disabled={rebuilding || nodes.length === 0}
              title="Re-analyse every node and recompute all edges"
            >
              {rebuilding ? "Rebuilding…" : "↻ Rebuild edges"}
            </button>
            <ModeTabs<Mode>
              active={mode}
              onChange={setMode}
              tabs={[
                { id: "explore", label: "Explore" },
                {
                  id: "quiz",
                  label: "Review",
                  disabled: edges.length === 0,
                },
                {
                  id: "sentence",
                  label: "AI sentence",
                  disabled: nodes.length === 0,
                },
              ]}
            />
          </div>
        }
      />

      {rebuildMsg && (
        <div className="text-sm text-ink/70">{rebuildMsg}</div>
      )}

      <GraphStats nodes={nodes} edges={edges} />

      {mode === "explore" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                className="input hanzi w-full sm:max-w-[160px]"
                placeholder="+ add word (汉字)"
                value={addHanzi}
                onChange={(e) => setAddHanzi(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onAddFromInput();
                }}
              />
              <button
                className="btn-primary w-full sm:w-auto"
                onClick={onAddFromInput}
                disabled={adding || !addHanzi.trim()}
              >
                {adding ? "Analyzing…" : "Add to knowledge graph"}
              </button>

              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <ToggleChip
                  active={filters.character}
                  color="#c0392b"
                  label="Character"
                  onClick={() =>
                    setFilters((f) => ({ ...f, character: !f.character }))
                  }
                />
                <ToggleChip
                  active={filters.meaning}
                  color="#2c7da0"
                  label="Meaning"
                  onClick={() =>
                    setFilters((f) => ({ ...f, meaning: !f.meaning }))
                  }
                />
              </div>
            </div>
            {addError && (
              <div className="text-sm text-red-600">{addError}</div>
            )}

            <GraphCanvas
              nodes={nodes}
              edges={edges}
              showMeaning={filters.meaning}
              showCharacter={filters.character}
              selectedId={selectedId}
              onSelect={setSelectedId}
              bloomEdgeIds={bloomEdgeIds}
            />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink/70">
              <span className="label">Legend</span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-1 w-6"
                  style={{ backgroundColor: "#c0392b" }}
                />
                shared radical
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-1 w-6"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, #2c7da0 0 4px, transparent 4px 7px)",
                  }}
                />
                shared meaning
              </span>
              <span className="hidden sm:ml-auto sm:inline">
                Click a node to focus · drag to rearrange
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <GraphNodePanel
              node={selectedNode}
              allNodes={nodes}
              edges={edges}
              onClose={() => setSelectedId(null)}
              onDelete={deleteNode}
              onSelect={(id) => setSelectedId(id)}
              onAddSuggestion={addWord}
            />
          </div>

          <MobileSheet
            open={Boolean(selectedNode)}
            onClose={() => setSelectedId(null)}
            label="Node detail"
          >
            {selectedNode && (
              <GraphNodePanel
                node={selectedNode}
                allNodes={nodes}
                edges={edges}
                onClose={() => setSelectedId(null)}
                onDelete={deleteNode}
                onSelect={(id) => setSelectedId(id)}
                onAddSuggestion={addWord}
                className="!border-0 !p-0 !shadow-none"
              />
            )}
          </MobileSheet>
        </div>
      )}

      {mode === "quiz" && <GraphQuiz nodes={nodes} edges={edges} />}

      {mode === "sentence" && <GraphSentence nodes={nodes} />}
    </div>
  );
}

function ToggleChip({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex min-h-[44px] items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium transition " +
        (active
          ? "border-ink bg-ink text-white"
          : "border-ink/20 bg-white text-ink/70 hover:bg-ink/5")
      }
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </button>
  );
}
