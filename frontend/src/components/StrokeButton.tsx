"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * makemeahanzi SVGs animate their strokes via a <style> block whose selectors
 * reference ids like `#make-me-a-hanzi-animation-0`. To safely render many of
 * these inline in one document we must rename every id consistently — in the
 * id attributes, the `url(#...)` refs AND the CSS text. A single string replace
 * of the shared `make-me-a-hanzi` token covers all three at once.
 */
function prepareSvg(raw: string, prefix: string): string {
  let svg = raw.replaceAll("make-me-a-hanzi", `mmah-${prefix}`);
  // Constrain the rendered size while keeping the original viewBox intact.
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
};

export function StrokeButton({ url, char }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef("");
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [failed, setFailed] = useState(false);

  const mountSvg = useCallback((svg: string) => {
    if (!wrapRef.current) return;
    // Clear and force a reflow so the CSS keyframe animations restart from 0.
    wrapRef.current.innerHTML = "";
    void wrapRef.current.offsetHeight;
    wrapRef.current.innerHTML = svg;
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
      className="rounded-md border border-ink/10 p-2 transition hover:border-ink/25 hover:bg-ink/[0.03]"
      onClick={onClick}
      aria-label={`Replay stroke order for ${char}`}
      title="Click to replay"
    >
      <div ref={wrapRef} className="h-16 w-16 overflow-hidden [&_svg]:block [&_svg]:h-16 [&_svg]:w-16" />
    </button>
  );
}
