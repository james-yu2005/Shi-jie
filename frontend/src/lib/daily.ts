import type { GameAttempt } from "./types";

export const DAILY_MAX_ATTEMPTS = 3;

/** Static demo puzzle for onboarding — fixed laptop on desk image. */
export const DAILY_EXAMPLE = {
  imageUrl: "https://picsum.photos/id/0/400/300",
  targetDesc: "一台笔记本电脑在桌子上。",
  attempts: [
    {
      prompt: "有一台电脑。",
      score: 52,
      solved: false,
      missing_elements: ["laptop (not just computer)", "on desk"],
      grammar_errors: [],
      hint: "You found the computer — now specify it's a laptop and where it is.",
      reveal: null,
      vocab_hints: [
        {
          hanzi: "笔记本电脑",
          pinyin: "bǐjìběn diànnǎo",
          jyutping: "bat1 gei3 bun2 din6 nou5",
          definition: "laptop computer",
        },
      ],
    },
    {
      prompt: "一台笔记本电脑在桌子上。",
      score: 97,
      solved: true,
      missing_elements: [],
      grammar_errors: [],
      hint: "",
      reveal: "一台笔记本电脑在桌子上。",
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
