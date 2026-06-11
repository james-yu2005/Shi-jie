import type { AudioPreference } from "./types";

const TTS_BASE =
  "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob";

export function ttsLang(audio: AudioPreference): string {
  return audio === "cantonese" ? "zh-HK" : "zh-CN";
}

export function ttsUrl(text: string, audio: AudioPreference): string {
  return `${TTS_BASE}&tl=${ttsLang(audio)}&q=${encodeURIComponent(text)}`;
}

export function speechLang(audio: AudioPreference): string {
  return ttsLang(audio);
}

export function playChineseAudio(text: string, audio: AudioPreference): void {
  const audioEl = new Audio(ttsUrl(text, audio));
  audioEl.play().catch(() => {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(audio);
      u.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  });
}
