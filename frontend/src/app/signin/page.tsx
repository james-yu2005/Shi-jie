"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="mx-auto mt-20 max-w-md card text-center">
      <h1 className="hanzi mb-2 text-3xl font-bold">世界</h1>
      <p className="mb-6 text-ink/70">
        Sign in to save your flashcards and daily game progress.
      </p>
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="btn-primary mx-auto w-full"
      >
        Continue with Google
      </button>
    </div>
  );
}
