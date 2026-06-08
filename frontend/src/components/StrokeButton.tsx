"use client";
import { useCallback, useEffect, useRef, useState } from "react";

function replaySvgAnimations(container: HTMLElement) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.replaceWith(svg.cloneNode(true));
}

type Props = {
  url: string;
  char: string;
};

export function StrokeButton({ url, char }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((svg) => {
        if (cancelled || !wrapRef.current) return;
        wrapRef.current.innerHTML = svg;
        const svgEl = wrapRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.setAttribute("width", "64");
          svgEl.setAttribute("height", "64");
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [url]);

  const onClick = useCallback(() => {
    if (wrapRef.current) replaySvgAnimations(wrapRef.current);
  }, []);

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
      <div ref={wrapRef} className="h-16 w-16" />
    </button>
  );
}
