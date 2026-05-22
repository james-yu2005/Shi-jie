"use client";
import { signIn, signOut } from "next-auth/react";

type Props = {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
};

export function UserMenu({ user }: Props) {
  if (!user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="btn-outline ml-2"
        title="Sign in with Google"
      >
        Sign in
      </button>
    );
  }
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="ml-2 flex items-center gap-2">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          width={28}
          height={28}
          className="rounded-full"
        />
      ) : (
        <div className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-white">
          {initials}
        </div>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm text-ink/60 hover:text-ink"
        title={user.email ?? undefined}
      >
        Sign out
      </button>
    </div>
  );
}
