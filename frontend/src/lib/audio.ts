import type { AudioPreference } from "./types";

const TTS_BASE =
  "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob";

export function ttsLang(audio: AudioPreference): string {
  // yue-HK gives distinct Cantonese; zh-HK often aliases to the same stream as zh-CN.
  return audio === "cantonese" ? "yue-HK" : "zh-CN";
}

/** Google Translate TTS URL (used server-side by /api/tts). */
export function ttsUrl(text: string, audio: AudioPreference): string {
  return `${TTS_BASE}&tl=${ttsLang(audio)}&q=${encodeURIComponent(text)}`;
}

export function speechLang(audio: AudioPreference): string {
  return ttsLang(audio);
}

function proxiedTtsUrl(text: string, audio: AudioPreference): string {
  const qs = new URLSearchParams({ text, audio });
  return `/api/tts?${qs.toString()}`;
}

function speakWithSynthesis(text: string, audio: AudioPreference): void {
  if (!("speechSynthesis" in window)) return;
  const lang = speechLang(audio);
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) =>
      audio === "cantonese"
        ? v.lang.startsWith("yue") || v.lang.includes("HK")
        : v.lang.startsWith("zh-CN") || v.lang === "cmn-Hans-CN",
    ) ??
    voices.find((v) => v.lang.startsWith("zh"));

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  if (voice) u.voice = voice;
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

let activeAudio: HTMLAudioElement | null = null;

/**
 * Play Chinese TTS. Uses a same-origin proxy so mobile browsers (especially
 * iOS Safari) can load audio — direct translate.google.com URLs are blocked
 * cross-origin. Call play() synchronously inside the user tap/click handler.
 */
export function playChineseAudio(text: string, audio: AudioPreference): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  activeAudio?.pause();
  window.speechSynthesis?.cancel();

  const audioEl = new Audio(proxiedTtsUrl(trimmed, audio));
  activeAudio = audioEl;
  audioEl.play().catch(() => speakWithSynthesis(trimmed, audio));
}
