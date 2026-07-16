"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  dismissFirstWorld,
  firstWorldComplete,
  isFirstWorldDismissed,
  readFirstWorldProgress,
  type FirstWorldProgress,
} from "@/lib/first-world";

const STEPS: {
  id: keyof FirstWorldProgress;
  label: string;
  href: string;
  hint: string;
}[] = [
  {
    id: "sample",
    label: "Read a sample",
    href: "/",
    hint: "Generate sample text and press Read",
  },
  {
    id: "graph",
    label: "Save a word to the graph",
    href: "/",
    hint: "Click a word → Add to knowledge graph",
  },
  {
    id: "daily",
    label: "Try Daily (easy)",
    href: "/daily",
    hint: "Build a sentence with the phrase bank",
  },
];

export function FirstWorldChecklist() {
  const [progress, setProgress] = useState<FirstWorldProgress | null>(null);
  const [dismissed, setDismissed] = useState(true);

  const refresh = useCallback(() => {
    setProgress(readFirstWorldProgress());
    setDismissed(isFirstWorldDismissed());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("shijie-first-world", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("shijie-first-world", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refresh]);

  if (progress === null || dismissed || firstWorldComplete(progress)) {
    return null;
  }

  const doneCount = STEPS.filter((s) => progress[s.id]).length;

  return (
    <div className="border-b border-ink/10 bg-paper/90 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              First World
            </span>
            <span className="text-xs text-ink/45">
              {doneCount}/{STEPS.length}
            </span>
          </div>
          <ol className="mt-1.5 flex flex-wrap gap-2">
            {STEPS.map((step, i) => {
              const done = progress[step.id];
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    title={step.hint}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
                      done
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-ink/15 bg-white text-ink/80 hover:border-ink/30"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                        done ? "bg-green-600 text-white" : "bg-ink/10 text-ink/60"
                      }`}
                      aria-hidden
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {step.label}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
        <button
          type="button"
          className="btn-ghost shrink-0 self-start px-2 py-1 text-xs text-ink/50 sm:self-center"
          onClick={() => {
            dismissFirstWorld();
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
