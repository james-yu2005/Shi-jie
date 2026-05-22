export const DAILY_MAX_ATTEMPTS = 3;

/** DB stores attempts oldest-first; UI shows newest-first. */
export function attemptsNewestFirst<T>(attempts: T[]): T[] {
  return [...attempts].reverse();
}
