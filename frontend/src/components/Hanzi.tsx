"use client";

import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";

/** Inline Chinese text that respects the script preference toggle. */
export function Hanzi({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { displayHanzi } = useLearningPreferences();
  const rendered = displayHanzi(text);
  if (className) return <span className={className}>{rendered}</span>;
  return <>{rendered}</>;
}
