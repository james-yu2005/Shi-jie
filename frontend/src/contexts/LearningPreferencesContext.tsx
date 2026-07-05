"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { playChineseAudio } from "@/lib/audio";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  STORAGE_KEY,
  type RawUserPreferences,
} from "@/lib/preferences";
import { pickEntryForm, toPreferredScriptSync } from "@/lib/script";
import { displayStoredHanzi as storedHanziForScript } from "@/lib/word-display";
import { apiJson, swrFetcher } from "@/lib/api";
import type {
  AudioPreference,
  DictEntry,
  ScriptPreference,
  UserPreferences,
} from "@/lib/types";

type LearningPreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  setScript: (script: ScriptPreference) => void;
  setAudio: (audio: AudioPreference) => void;
  displayHanzi: (text: string) => string;
  displayStoredHanzi: (hanzi: string, hanziTraditional?: string | null) => string;
  displayEntry: (entry: Pick<DictEntry, "traditional" | "simplified">) => string;
  romanization: (entry: DictEntry) => string;
  playAudio: (text: string) => void;
};

const LearningPreferencesContext =
  createContext<LearningPreferencesContextValue | null>(null);

function readLocalPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return normalizePreferences(JSON.parse(raw) as RawUserPreferences);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeLocalPreferences(prefs: UserPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function LearningPreferencesProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const syncedRef = useRef(false);
  const serverInitRef = useRef(false);

  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const { data: serverPrefs, mutate, isLoading } = useSWR<UserPreferences>(
    signedIn ? "/api/user/preferences" : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    setLocalPrefs(readLocalPreferences());
  }, []);

  useEffect(() => {
    if (!signedIn) {
      serverInitRef.current = false;
      return;
    }
    if (!serverPrefs || serverInitRef.current) return;

    const local = readLocalPreferences();
    const localIsDefault =
      local.script === DEFAULT_PREFERENCES.script &&
      local.audio === DEFAULT_PREFERENCES.audio;

    if (localIsDefault) {
      setLocalPrefs(serverPrefs);
      writeLocalPreferences(serverPrefs);
    }
    serverInitRef.current = true;
  }, [signedIn, serverPrefs]);

  useEffect(() => {
    if (!signedIn || syncedRef.current) return;
    syncedRef.current = true;
    const local = readLocalPreferences();
    if (
      local.script !== DEFAULT_PREFERENCES.script ||
      local.audio !== DEFAULT_PREFERENCES.audio
    ) {
      void apiJson<UserPreferences>("/api/user/preferences", {
        method: "PATCH",
        json: local,
      }).then(() => mutate());
    }
  }, [signedIn, mutate]);

  const preferences = localPrefs;

  useEffect(() => {
    document.body.dataset.script = preferences.script;
    document.body.dataset.audio = preferences.audio;
  }, [preferences.script, preferences.audio]);

  const persist = useCallback(
    async (next: UserPreferences) => {
      setLocalPrefs(next);
      writeLocalPreferences(next);
      if (signedIn) {
        await apiJson<UserPreferences>("/api/user/preferences", {
          method: "PATCH",
          json: next,
        });
        void mutate(next, { revalidate: false });
      }
    },
    [signedIn, mutate],
  );

  const setScript = useCallback(
    (script: ScriptPreference) => {
      void persist({ ...preferences, script });
    },
    [persist, preferences],
  );

  const setAudio = useCallback(
    (audio: AudioPreference) => {
      void persist({ ...preferences, audio });
    },
    [persist, preferences],
  );

  const displayHanzi = useCallback(
    (text: string) => toPreferredScriptSync(text, preferences.script),
    [preferences.script],
  );

  const displayStoredHanzi = useCallback(
    (hanzi: string, hanziTraditional?: string | null) =>
      storedHanziForScript(hanzi, preferences.script, hanziTraditional),
    [preferences.script],
  );

  const displayEntry = useCallback(
    (entry: Pick<DictEntry, "traditional" | "simplified">) =>
      pickEntryForm(entry, preferences.script),
    [preferences.script],
  );

  const romanization = useCallback(
    (entry: DictEntry) => {
      if (preferences.audio === "cantonese") {
        return entry.jyutping || entry.pinyin || entry.pinyin_numbered || "";
      }
      return entry.pinyin || entry.pinyin_numbered || "";
    },
    [preferences.audio],
  );

  const playAudio = useCallback(
    (text: string) => {
      playChineseAudio(text, preferences.audio);
    },
    [preferences.audio],
  );

  const value = useMemo(
    () => ({
      preferences,
      loading: signedIn && isLoading,
      setScript,
      setAudio,
      displayHanzi,
      displayStoredHanzi,
      displayEntry,
      romanization,
      playAudio,
    }),
    [
      preferences,
      signedIn,
      isLoading,
      setScript,
      setAudio,
      displayHanzi,
      displayStoredHanzi,
      displayEntry,
      romanization,
      playAudio,
    ],
  );

  return (
    <LearningPreferencesContext.Provider value={value}>
      {children}
    </LearningPreferencesContext.Provider>
  );
}

export function useLearningPreferences() {
  const ctx = useContext(LearningPreferencesContext);
  if (!ctx) {
    throw new Error("useLearningPreferences must be used within LearningPreferencesProvider");
  }
  return ctx;
}
