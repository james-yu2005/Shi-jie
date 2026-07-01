import type { GameAttempt } from "./types";

export const DAILY_MAX_ATTEMPTS = 3;

/** Static demo puzzle for onboarding — orange cat on a desk. */
export const DAILY_EXAMPLE = {
  imageUrl: "https://picsum.photos/seed/example-cat/400/300",
  targetDesc: "一只橙色的猫坐在木桌上。",
  attempts: [
    {
      prompt: "有一只猫。",
      score: 42,
      solved: false,
      missing_elements: ["orange fur", "wooden table"],
      grammar_errors: [],
      hint: "You spotted the cat — now add its color and where it's sitting.",
      reveal: null,
      vocab_hints: [
        {
          hanzi: "桌子",
          pinyin: "zhuōzi",
          jyutping: "coek1 zi2",
          definition: "table; desk",
        },
      ],
    },
    {
      prompt: "一只橙色的猫坐在木桌上。",
      score: 95,
      solved: true,
      missing_elements: [],
      grammar_errors: [],
      hint: "",
      reveal: "一只橙色的猫坐在木桌上。",
      vocab_hints: [],
    },
  ] satisfies GameAttempt[],
};

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

/** Stable daily image via Lorem Picsum (seed = dayKey ensures same image all day). */
export function imageForDay(key: string): string {
  return `https://picsum.photos/seed/${key}/800/600`;
}

/** Old providers that stopped serving images reliably. */
export function isLegacyDailyImageUrl(url: string): boolean {
  return (
    url.includes("source.unsplash.com") ||
    url.includes("loremflickr.com") ||
    (url.includes("images.unsplash.com") && url.includes("photo-"))
  );
}

/** DB stores attempts oldest-first; UI shows newest-first. */
export function attemptsNewestFirst<T>(attempts: T[]): T[] {
  return [...attempts].reverse();
}
