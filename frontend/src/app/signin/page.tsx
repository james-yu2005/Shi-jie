"use client";
import { signIn } from "next-auth/react";

const FEATURES = [
  {
    icon: "📖",
    title: "Read anything",
    body: "Paste any Chinese text. Click a word for definitions, pinyin, stroke order, and pronunciation.",
  },
  {
    icon: "🃏",
    title: "Flashcard bucket",
    body: "Save words as you read. Test yourself or weave generate them into AI-generated paragraphs.",
  },
  {
    icon: "🌐",
    title: "Personal knowledge graph",
    body: "Link words by shared radical or shared meaning and get tested on the connections",
  },
  {
    icon: "🖼️",
    title: "Daily Game",
    body: "Describe today's image in Chinese. A vision agent grades you, hints what you missed, and reveals the target.",
  },
];

export default function SignInPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <section className="space-y-6">
        <h1 className="page-title text-balance text-3xl sm:text-5xl">
          Read, save, and learn Chinese.
        </h1>
        <p className="lead max-w-xl text-base">
          A focused study app for the learners with many features: a smart reader that translates text,
          a flashcard bucket, a personal knowledge graph, and a daily game.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="btn-primary w-full text-base sm:w-auto"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card space-y-2">
            <div className="text-2xl leading-none">{f.icon}</div>
            <div className="font-semibold">{f.title}</div>
            <p className="text-sm text-ink/70">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.3a12 12 0 0 1-7.5 2.6c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.4l6.5 5.3C41 35 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
