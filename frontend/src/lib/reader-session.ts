import type { ReaderReadResult } from "./types";

const SESSION_KEY = "shijie-reader-session";

export type ReaderSession = {
  text: string;
  readResult: ReaderReadResult | null;
  showPinyin: boolean;
  showTranslation: boolean;
};

export function loadReaderSession(): ReaderSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReaderSession>;
    if (typeof parsed.text !== "string") return null;
    return {
      text: parsed.text,
      readResult: parsed.readResult ?? null,
      showPinyin: Boolean(parsed.showPinyin),
      showTranslation: parsed.showTranslation !== false,
    };
  } catch {
    return null;
  }
}

export function saveReaderSession(session: ReaderSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearReaderSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}
