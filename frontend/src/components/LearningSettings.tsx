"use client";

import { useLearningPreferences } from "@/contexts/LearningPreferencesContext";
import type { AudioPreference, ScriptPreference } from "@/lib/types";
import { PreferenceDropdown } from "./PreferenceDropdown";

const SCRIPT_OPTIONS = [
  { value: "simplified" as ScriptPreference, label: "简体" },
  { value: "traditional" as ScriptPreference, label: "繁體" },
] as const;

const AUDIO_OPTIONS = [
  { value: "mandarin" as AudioPreference, label: "普通话" },
  { value: "cantonese" as AudioPreference, label: "粤语" },
] as const;

export function LearningSettings() {
  const { preferences, setScript, setAudio } = useLearningPreferences();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <PreferenceDropdown
        label="Script"
        value={preferences.script}
        options={SCRIPT_OPTIONS}
        onChange={setScript}
        ariaLabel="Chinese script preference"
      />
      <PreferenceDropdown
        label="Audio"
        value={preferences.audio}
        options={AUDIO_OPTIONS}
        onChange={setAudio}
        ariaLabel="Audio preference"
      />
    </div>
  );
}
