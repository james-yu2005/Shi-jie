"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DISMISS_KEY = "shijie-guide-collapsed";

const SECTIONS = [
  {
    title: "Smart Reader",
    href: "/",
    body: "Paste Chinese text and press Read. Each sentence gets a translation underneath. Click any character to look it up in the panel on the right. Hover over the English to see which Chinese words it came from.",
  },
  {
    title: "Flashcards",
    href: "/flashcards",
    body: "Words you save from the reader end up here. Review them when they're due, or load the starter deck if you're just beginning. Sign in so your list sticks around.",
  },
  {
    title: "Knowledge Graph",
    href: "/graph",
    body: "A visual map of words you've saved — grouped by radical, meaning, and how they connect. Add words from the reader's side panel. Needs sign in.",
  },
  {
    title: "Daily Game",
    href: "/daily",
    body: "One picture a day. Write a sentence in Chinese describing it and get feedback. Good for putting vocabulary into practice.",
  },
] as const;

function GuideModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.getSelection()?.removeAllRanges();
    const panel = panelRef.current;
    if (panel) {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onKeyDown]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="fixed inset-0 select-none bg-ink/35 backdrop-blur-md"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-xl outline-none sm:max-h-[76vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-paper px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              How to use 世界
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              A quick map of the site — takes about a minute.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost shrink-0 px-2 py-1 text-lg leading-none"
            onClick={onClose}
            aria-label="Close guide"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-ink/80">
            世界 helps you read Chinese text, look up words, save the ones you want to
            remember, and see how your vocabulary fits together. The four tabs across
            the top are the whole app — start here on the reader, then branch out when
            you find words worth keeping.
          </p>

          <ol className="space-y-4">
            {SECTIONS.map((s, i) => (
              <li key={s.href} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/5 text-xs font-semibold text-ink/70">
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <Link
                    href={s.href}
                    className="font-medium text-ink hover:text-accent"
                    onClick={onClose}
                  >
                    {s.title} →
                  </Link>
                  <p className="text-sm leading-relaxed text-ink/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm text-ink/70">
            <p className="font-medium text-ink">While you read</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Try <b>Generate sample</b> if you don&apos;t have text handy.
              </li>
              <li>
                Toggle pinyin and the English translation with the checkboxes above
                the text.
              </li>
              <li>
                Press <b>🔊</b> next to a sentence to hear it aloud.
              </li>
              <li>
                Top right of the header: pick simplified or traditional characters,
                and Mandarin or Cantonese audio.
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink/10 px-5 py-4">
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SiteGuide() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  function collapseBanner() {
    localStorage.setItem(DISMISS_KEY, "1");
    setCollapsed(true);
  }

  function openGuide() {
    window.getSelection()?.removeAllRanges();
    setOpen(true);
  }

  return (
    <>
      {collapsed ? (
        <button
          type="button"
          className="select-none text-sm text-ink/60 underline decoration-ink/20 underline-offset-2 hover:text-ink"
          onClick={openGuide}
        >
          How the site works
        </button>
      ) : (
        <div className="subtle-card flex items-start gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 select-none text-left"
            onClick={openGuide}
          >
            <span className="text-sm font-medium text-ink">
              New here? See how the site works
            </span>
            <span className="mt-0.5 block text-sm text-ink/60">
              Four sections, one workflow — click for a short walkthrough.
            </span>
          </button>
          <button
            type="button"
            className="btn-ghost shrink-0 px-2 py-1 text-lg leading-none text-ink/50"
            onClick={collapseBanner}
            aria-label="Collapse introduction"
          >
            ×
          </button>
        </div>
      )}

      {open && <GuideModal onClose={() => setOpen(false)} />}
    </>
  );
}
