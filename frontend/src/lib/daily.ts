import type { GameAttempt } from "./types";

export const DAILY_MAX_ATTEMPTS = 3;

/** Static demo puzzle for onboarding — scenic landscape photo. */
export const DAILY_EXAMPLE = {
  imageUrl: "https://picsum.photos/seed/example-demo/400/300",
  targetDesc: "一座山在蓝色的湖边。",
  attempts: [
    {
      prompt: "有一座山。",
      score: 48,
      solved: false,
      missing_elements: ["blue lake", "beside/at the edge"],
      grammar_errors: [],
      hint: "You found the mountain — now describe the water and their relationship.",
      reveal: null,
      vocab_hints: [
        {
          hanzi: "湖",
          pinyin: "hú",
          jyutping: "wu4",
          definition: "lake",
        },
      ],
    },
    {
      prompt: "一座山在蓝色的湖边。",
      score: 96,
      solved: true,
      missing_elements: [],
      grammar_errors: [],
      hint: "",
      reveal: "一座山在蓝色的湖边。",
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
