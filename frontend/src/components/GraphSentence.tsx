"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KgNode } from "@/lib/types";
import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";

type Props = { nodes: KgNode[] };

export function GraphSentence({ nodes }: Props) {
  const { displayHanzi } = useLearningPreferences();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(nodes.slice(0, Math.min(8, nodes.length)).map((n) => n.id)),
  );
  const [paragraph, setParagraph] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const generate = useCallback(async () => {
    setError(null);
    setLoading(true);
    setParagraph(null);
    try {
      const r = await fetch("/api/kg/sentence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeIds: [...selected] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setParagraph(j.paragraph as string);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const sendToReader = useCallback(() => {
    if (!paragraph) return;
    router.push(`/?text=${encodeURIComponent(paragraph)}`);
  }, [paragraph, router]);

  const selectedWords = useMemo(
    () => nodes.filter((n) => selected.has(n.id)).map((n) => n.hanzi),
    [nodes, selected],
  );

  if (nodes.length === 0) {
    return (
      <div className="card text-sm text-ink/60">
        Add at least one node to your knowledge graph, then come back to weave them into
        a sentence.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="label">Pick the words to weave</div>
        <span className="text-xs text-ink/60">
          {selected.size} / {nodes.length} selected
        </span>
        <div className="ml-auto flex gap-2">
          <button className="btn-outline" onClick={selectAll}>
            All
          </button>
          <button className="btn-outline" onClick={clear}>
            None
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {nodes.map((n) => {
          const on = selected.has(n.id);
          return (
            <button
              key={n.id}
              onClick={() => toggle(n.id)}
              className={
                "rounded-full border px-3 py-1 text-sm transition " +
                (on
                  ? "border-ink/20 bg-ink/10 text-ink"
                  : "border-ink/15 bg-white hover:bg-ink/5")
              }
            >
              <span className="hanzi text-base">{displayHanzi(n.hanzi)}</span>
              {n.pinyin && (
                <span className="ml-1 text-xs text-ink/60">
                  {n.pinyin}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          onClick={generate}
          disabled={loading || selected.size === 0}
        >
          {loading ? "Generating…" : "Weave into paragraph"}
        </button>
        {paragraph && (
          <button className="btn-outline" onClick={sendToReader}>
            Open in Smart Reader →
          </button>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {paragraph && (
        <div className="space-y-2">
          <div className="label">Generated paragraph</div>
          <div className="hanzi rounded-md border border-ink/10 bg-paper p-4 text-base leading-loose">
            {paragraph}
          </div>
          <div className="text-xs text-ink/60">
            Words used: {selectedWords.map(displayHanzi).join("、")}
          </div>
        </div>
      )}
    </div>
  );
}
