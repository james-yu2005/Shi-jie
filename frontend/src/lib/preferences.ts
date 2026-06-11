import { prisma } from "./prisma";
import type { AudioPreference, ScriptPreference, UserPreferences } from "./types";

export const DEFAULT_PREFERENCES: UserPreferences = {
  script: "simplified",
  audio: "mandarin",
};

export const STORAGE_KEY = "shijie-learning-prefs";

const SCRIPT_VALUES = new Set<ScriptPreference>(["simplified", "traditional"]);
const AUDIO_VALUES = new Set<AudioPreference>(["mandarin", "cantonese"]);

/** Accepts DB/localStorage strings; narrows to typed preferences. */
export function normalizePreferences(raw: Partial<{ script?: string; audio?: string }>): UserPreferences {
  return {
    script: SCRIPT_VALUES.has(raw.script as ScriptPreference)
      ? (raw.script as ScriptPreference)
      : DEFAULT_PREFERENCES.script,
    audio: AUDIO_VALUES.has(raw.audio as AudioPreference)
      ? (raw.audio as AudioPreference)
      : DEFAULT_PREFERENCES.audio,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { script: true, audio: true },
  });
  if (!user) return DEFAULT_PREFERENCES;
  return normalizePreferences(user);
}

export function preferencesQuery(
  prefs: UserPreferences,
  extra?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("script", prefs.script);
  params.set("audio", prefs.audio);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) params.set(key, value);
    }
  }
  return params.toString();
}

/** Payload fields for FastAPI routes that accept LearningPrefs. */
export function backendLearningPrefs(prefs: UserPreferences) {
  return { script: prefs.script, locale: prefs.audio };
}
