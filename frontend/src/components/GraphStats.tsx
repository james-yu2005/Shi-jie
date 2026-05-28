"use client";
import { useMemo } from "react";
import type { KgEdge, KgNode } from "@/lib/types";

type Props = { nodes: KgNode[]; edges: KgEdge[] };

export function GraphStats({ nodes, edges }: Props) {
  const stats = useMemo(() => {
    const meaningEdges = edges.filter((e) => e.type === "meaning").length;
    const characterEdges = edges.filter((e) => e.type === "character").length;
    const radicalCounts = new Map<string, number>();
    for (const n of nodes) {
      for (const r of n.radicals) {
        radicalCounts.set(r, (radicalCounts.get(r) ?? 0) + 1);
      }
    }
    const tagCounts = new Map<string, number>();
    for (const n of nodes) {
      for (const t of n.semanticTags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const topRadicals = [...radicalCounts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topTags = [...tagCounts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const degrees = new Map<string, number>();
    for (const e of edges) {
      degrees.set(e.sourceId, (degrees.get(e.sourceId) ?? 0) + 1);
      degrees.set(e.targetId, (degrees.get(e.targetId) ?? 0) + 1);
    }
    const hub = nodes
      .map((n) => ({ node: n, deg: degrees.get(n.id) ?? 0 }))
      .sort((a, b) => b.deg - a.deg)[0];
    return {
      meaningEdges,
      characterEdges,
      topRadicals,
      topTags,
      hub: hub && hub.deg > 0 ? hub : null,
    };
  }, [nodes, edges]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Nodes" value={nodes.length} />
      <Stat
        label="Meaning edges"
        value={stats.meaningEdges}
        color="#2c7da0"
      />
      <Stat
        label="Character edges"
        value={stats.characterEdges}
        color="#c0392b"
      />
      <Stat
        label="Most connected"
        value={stats.hub ? stats.hub.node.hanzi : "—"}
        sub={stats.hub ? `${stats.hub.deg} edges` : undefined}
        hanzi={Boolean(stats.hub)}
      />
      {(stats.topRadicals.length > 0 || stats.topTags.length > 0) && (
        <div className="card col-span-2 lg:col-span-4">
          {stats.topRadicals.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="label">Top radicals</span>
              {stats.topRadicals.map(([r, c]) => (
                <span
                  key={r}
                  className=" rounded-md border border-ink/15 bg-paper px-2 py-0.5 text-base"
                >
                  {r}
                  <span className="ml-1 text-xs text-ink/60">×{c}</span>
                </span>
              ))}
            </div>
          )}
          {stats.topTags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="label">Top themes</span>
              {stats.topTags.map(([t, c]) => (
                <span
                  key={t}
                  className="rounded-full bg-[#2c7da0]/10 px-2 py-0.5 text-xs font-medium text-[#2c7da0]"
                >
                  {t}
                  <span className="ml-1 text-[10px] text-ink/60">x{c}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
  hanzi,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  hanzi?: boolean;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div
        className={
          (hanzi ? "hanzi " : "") +
          "mt-1 text-2xl font-bold"
        }
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-ink/60">{sub}</div>}
    </div>
  );
}
