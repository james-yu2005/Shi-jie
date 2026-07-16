"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * makemeahanzi SVGs animate their strokes via a <style> block whose selectors
 * reference ids like `#make-me-a-hanzi-animation-0`. To safely render many of
 * these inline in one document we must rename every id consistently — in the
 * id attributes, the `url(#...)` refs AND the CSS text. A single string replace
 * of the shared `make-me-a-hanzi` token covers all three at once.
 */
function prepareSvg(raw: string, prefix: string) {
  let svg = raw.replaceAll("make-me-a-hanzi", `mmah-${prefix}`);

  // `both` applies the blue `from` keyframe during animation-delay, previewing
  // strokes before their turn. Use `forwards` + stroke:none default instead.
  svg = svg.replace(
    /(<style type="text\/css">\s*)/,
    `$1\n        [id*="mmah-${prefix}-animation-"] { stroke: none; }\n`
  );
  svg = svg.replace(/animation:\s*(keyframes\d+\s+[^;]+)\s+both/g, "animation: $1 forwards");
  svg = svg.replace(/stroke:\s*blue/g, "stroke: black");
  svg = svg.replace(
    /stroke-dasharray="(\d+(?:\.\d+)?)[\s,]+\d+(?:\.\d+)?"/g,
    (full, dash) => `stroke-dashoffset="${dash}" ${full}`
  );
  svg = svg.replace(
    /to\s*\{\s*stroke:\s*black;\s*stroke-width:\s*1024;\s*\}/g,
    "to { stroke: black; stroke-width: 1024; stroke-dashoffset: 0; }"
  );
  svg = svg.replace(
    /<svg([^>]*)>/,
    (_m, attrs) =>
      `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} width="64" height="64">`
  );

  return svg;
}

type Props = {
  url: string;
  char: string;
  /** Auto-mount (and thus animate) when the SVG loads. */
  autoPlay?: boolean;
};

export function StrokeButton({ url, char, autoPlay = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef("");
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [failed, setFailed] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const mountSvg = useCallback((svg: string) => {
    if (!wrapRef.current) return;
    wrapRef.current.innerHTML = "";
    void wrapRef.current.offsetHeight;
    wrapRef.current.innerHTML = svg;
    setRevealKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    svgRef.current = "";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((raw) => {
        if (cancelled) return;
        const svg = prepareSvg(raw, instanceId);
        svgRef.current = svg;
        // Always mount so strokes animate; CSS skips entrance when reduced-motion.
        mountSvg(svg);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, instanceId, mountSvg]);

  const onClick = useCallback(() => {
    if (!svgRef.current) return;
    mountSvg(svgRef.current);
  }, [mountSvg]);

  if (failed) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-ink/10 p-2">
        <span className="hanzi text-2xl">{char}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`ink-reveal rounded-md border border-ink/10 p-2 transition hover:border-ink/25 hover:bg-ink/[0.03] ${
        autoPlay ? "ink-reveal--enter" : ""
      }`}
      onClick={onClick}
      aria-label={`Replay stroke order for ${char}`}
      title="Click to replay"
      data-reveal={revealKey}
    >
      <div
        ref={wrapRef}
        className="h-16 w-16 overflow-hidden [&_svg]:block [&_svg]:h-16 [&_svg]:w-16"
      />
    </button>
  );
}
