"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { KgEdge, KgNode } from "@/lib/types";
import { apiJson } from "@/lib/api";

type Props = {
  nodes: KgNode[];
  edges: KgEdge[];
};

type Pair = {
  a: KgNode;
  b: KgNode;
  edges: KgEdge[];
};

type AiCheck = {
  explanation: string;
  loading: boolean;
  error: string | null;
};

function pickRandomPair(
  nodes: KgNode[],
  edges: KgEdge[],
  exclude: Set<string>,
): Pair | null {
  if (edges.length === 0) return null;
  const byPair = new Map<string, KgEdge[]>();
  for (const e of edges) {
    const key = [e.sourceId, e.targetId].sort().join(":");
    const arr = byPair.get(key) ?? [];
    arr.push(e);
    byPair.set(key, arr);
  }
  const keys = [...byPair.keys()].filter((k) => !exclude.has(k));
  if (keys.length === 0) return null;
  const key = keys[Math.floor(Math.random() * keys.length)];
  const edgePair = byPair.get(key) ?? [];
  const [aId, bId] = key.split(":");
  const a = nodes.find((n) => n.id === aId);
  const b = nodes.find((n) => n.id === bId);
  if (!a || !b) return null;
  return { a, b, edges: edgePair };
}

export function GraphQuiz({ nodes, edges }: Props) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [pair, setPair] = useState<Pair | null>(null);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [aiCheck, setAiCheck] = useState<AiCheck | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const available = useMemo(() => {
    const keys = new Set<string>();
    for (const e of edges) {
      keys.add([e.sourceId, e.targetId].sort().join(":"));
    }
    return keys.size;
  }, [edges]);

  const next = useCallback(() => {
    setAnswer("");
    setRevealed(false);
    setAiCheck(null);
    const p = pickRandomPair(nodes, edges, seen);
    if (!p && seen.size > 0) {
      // recycle deck when we've cycled through every pair
      setSeen(new Set());
      setPair(pickRandomPair(nodes, edges, new Set()));
      return;
    }
    setPair(p);
  }, [nodes, edges, seen]);

  useEffect(() => {
    if (!pair) next();
    // run only once on mount when we have data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  const reveal = useCallback(() => {
    if (!pair) return;
    setRevealed(true);
    setSeen((s) => {
      const next = new Set(s);
      next.add([pair.a.id, pair.b.id].sort().join(":"));
      return next;
    });
  }, [pair]);

  const askAi = useCallback(async () => {
    if (!pair) return;
    setAiCheck({ explanation: "", loading: true, error: null });
    try {
      const j = await apiJson<{ explanation: string }>("/api/kg/connection", {
        method: "POST",
        json: { sourceId: pair.a.id, targetId: pair.b.id },
      });
      setAiCheck({
        explanation: j.explanation,
        loading: false,
        error: null,
      });
    } catch (e) {
      setAiCheck({ explanation: "", loading: false, error: String(e) });
    }
  }, [pair]);

  if (available === 0) {
    return (
      <div className="card text-sm text-ink/60">
        You need at least one connected pair of nodes. Add more words and let
        the graph build edges.
      </div>
    );
  }

  if (!pair) {
    return <div className="card text-sm text-ink/60">Loading…</div>;
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="label">Connection quiz</div>
        <div className="text-xs text-ink/60">
          Score: <b>{score.correct}</b> / {score.total}
        </div>
      </div>

      <div className="flex items-center justify-around rounded-md border border-ink/10 bg-paper p-4">
        <NodeBadge node={pair.a} />
        <div className="text-2xl text-ink/40">↔</div>
        <NodeBadge node={pair.b} />
      </div>

      <div>
        <label className="label mb-1 block">
          How are these two words connected?
        </label>
        <textarea
          className="textarea min-h-[80px]"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="e.g. they both relate to motion; they share the 扌 radical…"
          disabled={revealed}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!revealed ? (
          <button
            className="btn-primary"
            onClick={reveal}
            disabled={!answer.trim()}
          >
            Reveal answer
          </button>
        ) : (
          <>
            <button
              className="btn-outline"
              onClick={() => {
                setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
                next();
              }}
            >
              ✓ I had it
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                setScore((s) => ({ ...s, total: s.total + 1 }));
                next();
              }}
            >
              ✗ Missed it
            </button>
            <button
              className="btn-outline"
              onClick={askAi}
              disabled={aiCheck?.loading}
            >
              {aiCheck?.loading ? "Asking AI…" : "Ask AI to explain"}
            </button>
          </>
        )}
        <button className="btn-outline ml-auto" onClick={next}>
          Skip
        </button>
      </div>

      {revealed && (
        <div className="space-y-2 rounded-md border border-ink/10 bg-paper p-3 text-sm">
          <div className="label">Stored connection</div>
          {pair.edges.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: e.type === "meaning" ? "#2c7da0" : "#c0392b",
                }}
              />
              <span className="text-xs uppercase tracking-wide text-ink/60">
                {e.type}
              </span>
              <span>{e.reason}</span>
            </div>
          ))}
          {aiCheck?.error && (
            <div className="text-red-600">{aiCheck.error}</div>
          )}
          {aiCheck && !aiCheck.loading && aiCheck.explanation && (
            <div className="border-t border-ink/10 pt-2">
              <div className="label mb-1">AI explanation</div>
              <div>{aiCheck.explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NodeBadge({ node }: { node: KgNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="hanzi text-3xl font-bold">{node.hanzi}</div>
      <div className="text-xs text-ink/70">{node.pinyin}</div>
      <div className="text-xs text-ink/50">{node.definition}</div>
    </div>
  );
}
