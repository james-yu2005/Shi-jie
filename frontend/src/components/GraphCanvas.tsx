"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KgEdge, KgNode } from "@/lib/types";

type Pos = { x: number; y: number; vx: number; vy: number };
type Viewport = { x: number; y: number; scale: number };

type Props = {
  nodes: KgNode[];
  edges: KgEdge[];
  showMeaning: boolean;
  showCharacter: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

// World coordinate system: nodes live in 0..W × 0..H. We render them
// inside a <g transform="translate(viewport.x, viewport.y) scale(s)"> so
// pan/zoom is independent of the simulation.
const W = 1100;
const H = 720;
const MEANING_COLOR = "#2c7da0";
const CHARACTER_COLOR = "#c0392b";
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;

export function GraphCanvas({
  nodes,
  edges,
  showMeaning,
  showCharacter,
  selectedId,
  onSelect,
}: Props) {
  const positionsRef = useRef<Record<string, Pos>>({});
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(
    null,
  );
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const justPannedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, setTick] = useState(0);
  // Animation-loop control so we can pause when the layout settles.
  const runningRef = useRef(false);
  const frameRef = useRef(0);
  const settleFramesRef = useRef(0);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // Initialise positions for new nodes; drop stale ones.
  useEffect(() => {
    const pos = positionsRef.current;
    const n = Math.max(nodes.length, 1);
    nodes.forEach((node, i) => {
      if (!pos[node.id]) {
        const angle = (i / n) * Math.PI * 2;
        pos[node.id] = {
          x: W / 2 + Math.cos(angle) * 220,
          y: H / 2 + Math.sin(angle) * 220,
          vx: 0,
          vy: 0,
        };
      }
    });
    for (const id of Object.keys(pos)) {
      if (!nodes.find((node) => node.id === id)) delete pos[id];
    }
    rerender();
  }, [nodes, rerender]);

  const visibleEdges = useMemo(
    () =>
      edges.filter((e) =>
        e.type === "meaning" ? showMeaning : showCharacter,
      ),
    [edges, showMeaning, showCharacter],
  );
  // Keep the latest edges readable from the (stable) animation callback.
  const visibleEdgesRef = useRef(visibleEdges);
  visibleEdgesRef.current = visibleEdges;

  // One physics frame. Returns once the layout has been still for a while so
  // the loop can pause instead of burning CPU on a settled graph.
  const step = useCallback(() => {
    const pos = positionsRef.current;
    const ids = Object.keys(pos);
    for (let i = 0; i < ids.length; i++) {
      const a = pos[ids[i]];
      for (let j = i + 1; j < ids.length; j++) {
        const b = pos[ids[j]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        const f = 8000 / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    for (const e of visibleEdgesRef.current) {
      const a = pos[e.sourceId];
      const b = pos[e.targetId];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const rest = 150;
      const k = 0.035;
      const f = k * (d - rest);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    let maxV2 = 0;
    for (const id of ids) {
      const n = pos[id];
      n.vx += (W / 2 - n.x) * 0.0015;
      n.vy += (H / 2 - n.y) * 0.0015;
      n.vx *= 0.82;
      n.vy *= 0.82;
      if (draggingRef.current?.id !== id) {
        n.x += n.vx;
        n.y += n.vy;
      }
      const v2 = n.vx * n.vx + n.vy * n.vy;
      if (v2 > maxV2) maxV2 = v2;
    }
    setTick((t) => t + 1);

    // Pause once everything has been essentially motionless for ~40 frames
    // (and we're not mid-drag). Interaction/data changes call ensureRunning.
    if (draggingRef.current == null && maxV2 < 0.04) {
      settleFramesRef.current += 1;
    } else {
      settleFramesRef.current = 0;
    }
    if (settleFramesRef.current > 40) {
      settleFramesRef.current = 0;
      runningRef.current = false;
      return;
    }
    frameRef.current = requestAnimationFrame(step);
  }, []);

  const ensureRunning = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    settleFramesRef.current = 0;
    frameRef.current = requestAnimationFrame(step);
  }, [step]);

  // (Re)start the layout whenever the node set or visible edges change.
  useEffect(() => {
    if (nodes.length === 0) return;
    ensureRunning();
    return () => {
      cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
    };
  }, [nodes, visibleEdges, ensureRunning]);

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>();
    for (const e of visibleEdges) {
      if (e.sourceId === selectedId) set.add(e.targetId);
      if (e.targetId === selectedId) set.add(e.sourceId);
    }
    return set;
  }, [selectedId, visibleEdges]);

  // Convert a client (mouse) coord to SVG viewBox coord (un-transformed).
  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  // Convert SVG-local coord to world coord (apply inverse viewport).
  function toWorld(sx: number, sy: number) {
    const v = viewportRef.current;
    return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
  }

  function onNodePointerDown(e: React.PointerEvent<SVGGElement>, id: string) {
    e.stopPropagation();
    const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
    const { x: wx, y: wy } = toWorld(sx, sy);
    const p = positionsRef.current[id];
    if (!p) return;
    draggingRef.current = { id, offsetX: wx - p.x, offsetY: wy - p.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ensureRunning(); // wake the layout so neighbours react to the drag
  }

  function onSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (draggingRef.current) return;
    panRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: viewportRef.current.x,
      startY: viewportRef.current.y,
      moved: false,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = draggingRef.current;
    if (drag) {
      const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
      const { x: wx, y: wy } = toWorld(sx, sy);
      const p = positionsRef.current[drag.id];
      if (!p) return;
      p.x = wx - drag.offsetX;
      p.y = wy - drag.offsetY;
      p.vx = 0;
      p.vy = 0;
      ensureRunning();
      rerender();
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const svg = svgRef.current;
    if (!svg) return;
    // Convert pixel delta to viewBox delta so panning feels 1:1 with the
    // cursor regardless of how the SVG is scaled by CSS.
    const rect = svg.getBoundingClientRect();
    const sx = (W / rect.width) * (e.clientX - pan.startClientX);
    const sy = (H / rect.height) * (e.clientY - pan.startClientY);
    if (Math.abs(sx) > 2 || Math.abs(sy) > 2) pan.moved = true;
    viewportRef.current.x = pan.startX + sx;
    viewportRef.current.y = pan.startY + sy;
    rerender();
  }

  function onPointerUp() {
    if (panRef.current) {
      justPannedRef.current = panRef.current.moved;
      panRef.current = null;
    }
    draggingRef.current = null;
  }

  function onSvgClick() {
    if (justPannedRef.current) {
      justPannedRef.current = false;
      return;
    }
    onSelect(null);
  }

  // ---- Manual zoom controls ----
  const zoomBy = useCallback(
    (factor: number) => {
      const v = viewportRef.current;
      const cx = W / 2;
      const cy = H / 2;
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      v.scale = newScale;
      v.x = cx - wx * newScale;
      v.y = cy - wy * newScale;
      rerender();
    },
    [rerender],
  );

  const fitToContent = useCallback(() => {
    const pos = positionsRef.current;
    const ids = Object.keys(pos);
    if (ids.length === 0) {
      viewportRef.current = { x: 0, y: 0, scale: 1 };
      rerender();
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const p = pos[id];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 80;
    const contentW = Math.max(maxX - minX + pad * 2, 1);
    const contentH = Math.max(maxY - minY + pad * 2, 1);
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(W / contentW, H / contentH)),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    viewportRef.current = {
      scale,
      x: W / 2 - cx * scale,
      y: H / 2 - cy * scale,
    };
    rerender();
  }, [rerender]);

  if (nodes.length === 0) {
    return (
      <div className="card flex h-[72vh] items-center justify-center text-center text-sm text-ink/60">
        <div className="max-w-md space-y-2">
          <div className="hanzi text-3xl">🌱</div>
          <p>
            Your knowledge graph is empty. Open the <b>Smart Reader</b>, click any word, and
            press <b>Add to knowledge graph</b> — or type a word in the input above to
            add it directly.
          </p>
        </div>
      </div>
    );
  }

  const v = viewportRef.current;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[72vh] min-h-[520px] w-full touch-none select-none rounded-xl border border-ink/10 bg-paper"
        style={{ cursor: panRef.current ? "grabbing" : "grab" }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onSvgClick}
      >
        <g transform={`translate(${v.x}, ${v.y}) scale(${v.scale})`}>
          {visibleEdges.map((e) => {
            const a = positionsRef.current[e.sourceId];
            const b = positionsRef.current[e.targetId];
            if (!a || !b) return null;
            const involvesSelected =
              selectedId &&
              (e.sourceId === selectedId || e.targetId === selectedId);
            const dim = selectedId ? !involvesSelected : false;
            const color = e.type === "meaning" ? MEANING_COLOR : CHARACTER_COLOR;
            return (
              <line
                key={e.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeOpacity={dim ? 0.08 : 0.55}
                strokeWidth={
                  (involvesSelected
                    ? 2.4
                    : 1.2 + Math.min(e.weight, 4) * 0.3) / v.scale
                }
                strokeDasharray={
                  e.type === "character" ? "0" : `${4 / v.scale} ${3 / v.scale}`
                }
              />
            );
          })}
          {nodes.map((n) => {
            const p = positionsRef.current[n.id];
            if (!p) return null;
            const isSel = n.id === selectedId;
            const isNeighbor = neighborIds.has(n.id);
            const dim = Boolean(selectedId) && !isSel && !isNeighbor;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                style={{ cursor: "grab", opacity: dim ? 0.25 : 1 }}
                onPointerDown={(ev) => onNodePointerDown(ev, n.id)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(n.id === selectedId ? null : n.id);
                }}
              >
                <circle
                  r={30}
                  fill="white"
                  stroke={isSel ? CHARACTER_COLOR : "#1a1a1a"}
                  strokeWidth={(isSel ? 3 : 1.4) / v.scale}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={n.hanzi.length > 2 ? 15 : n.hanzi.length === 2 ? 20 : 24}
                  fontFamily='"Noto Sans SC", "PingFang SC", sans-serif'
                  fill="#1a1a1a"
                >
                  {n.hanzi}
                </text>
                {n.pinyin && (
                  <text
                    textAnchor="middle"
                    y={46}
                    fontSize="11"
                    fill="#1a1a1a99"
                    fontFamily="ui-sans-serif, system-ui"
                  >
                    {n.pinyin}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md border border-ink/10 bg-white/95 p-1 shadow-sm">
        <button
          className="grid h-7 w-7 place-items-center rounded text-base text-ink/80 hover:bg-ink/5"
          onClick={() => zoomBy(1.2)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded text-base text-ink/80 hover:bg-ink/5"
          onClick={() => zoomBy(1 / 1.2)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded text-xs text-ink/80 hover:bg-ink/5"
          onClick={fitToContent}
          title="Fit knowledge graph"
          aria-label="Fit knowledge graph"
        >
          ⤢
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-1 text-[11px] text-ink/60 shadow-sm">
        Use +/− to zoom · drag empty space to pan · drag node to move
      </div>
    </div>
  );
}
