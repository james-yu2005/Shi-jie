export const DAILY_MAX_ATTEMPTS = 3;

/** Curated Unsplash CDN photos — clear, learner-friendly subjects. */
const DAILY_UNSPLASH_PHOTOS = [
  "photo-1514888286974-6c03e2ca1dba",
  "photo-1506905925346-21bda4d32df4",
  "photo-1495474472287-4d71bcff2085",
  "photo-1485965120180-e99cd3d7822a",
  "photo-1587300003388-59208cc962cb",
  "photo-1507525428034-b723cf961d3e",
  "photo-1481627834876-b7833e8f5570",
  "photo-1490750967868-88aa4486c946",
  "photo-1449824913935-59a10b8d2000",
  "photo-1546069901-ba9599a1e63c",
  "photo-1441974231531-c6227db76b6e",
  "photo-1560806887-1e4cd64334bd",
  "photo-1497366216548-37526070297c",
  "photo-1510915361890-5158991c63fc",
  "photo-1544551763-46a013bb70d5",
  "photo-1509440159596-0249088772ff",
  "photo-1418989757141-909751ccc668",
  "photo-1470104180823-85f81d7fc3a7",
  "photo-1504674900247-0877df9cc836",
  "photo-1469474968028-56623f02e42e",
  "photo-1517849845537-4d257902454a",
  "photo-1500530855697-b586d89ba3ee",
  "photo-1472214103451-9374bd1c798e",
  "photo-1517248135467-4c7edcad34c4",
  "photo-1501854140801-50d01698950b",
] as const;

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function hashDayKey(key: string): number {
  return key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** Stable daily image via Unsplash CDN (no API key, no redirect chain). */
export function imageForDay(key: string): string {
  const slug = DAILY_UNSPLASH_PHOTOS[hashDayKey(key) % DAILY_UNSPLASH_PHOTOS.length];
  return `https://images.unsplash.com/${slug}?auto=format&fit=crop&w=800&h=600&q=80`;
}

/** Old providers that stopped serving images reliably. */
export function isLegacyDailyImageUrl(url: string): boolean {
  return (
    url.includes("picsum.photos") ||
    url.includes("source.unsplash.com") ||
    url.includes("loremflickr.com")
  );
}

/** DB stores attempts oldest-first; UI shows newest-first. */
export function attemptsNewestFirst<T>(attempts: T[]): T[] {
  return [...attempts].reverse();
}
