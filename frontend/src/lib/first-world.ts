/** Lightweight First World onboarding progress (localStorage). */

export const FIRST_WORLD_KEY = "shijie-first-world";
export const FIRST_WORLD_DISMISS_KEY = "shijie-first-world-dismissed";

export type FirstWorldStep = "sample" | "graph" | "daily";

export type FirstWorldProgress = {
  sample: boolean;
  graph: boolean;
  daily: boolean;
};

const DEFAULT: FirstWorldProgress = {
  sample: false,
  graph: false,
  daily: false,
};

export function readFirstWorldProgress(): FirstWorldProgress {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(FIRST_WORLD_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<FirstWorldProgress>;
    return {
      sample: Boolean(parsed.sample),
      graph: Boolean(parsed.graph),
      daily: Boolean(parsed.daily),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function isFirstWorldDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FIRST_WORLD_DISMISS_KEY) === "1";
}

export function dismissFirstWorld(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIRST_WORLD_DISMISS_KEY, "1");
  window.dispatchEvent(new CustomEvent("shijie-first-world"));
}

export function markFirstWorldStep(step: FirstWorldStep): void {
  if (typeof window === "undefined") return;
  const current = readFirstWorldProgress();
  if (current[step]) return;
  const next = { ...current, [step]: true };
  localStorage.setItem(FIRST_WORLD_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("shijie-first-world"));
}

export function firstWorldComplete(p: FirstWorldProgress): boolean {
  return p.sample && p.graph && p.daily;
}
