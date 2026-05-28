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
        className="btn-outline"
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
    <div className="flex items-center gap-2">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          width={28}
          height={28}
          className="rounded-full ring-1 ring-ink/10"
        />
      ) : (
        <div className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-medium text-white">
          {initials}
        </div>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="btn-ghost text-sm"
        title={user.email ?? "Sign out"}
      >
        Sign out
      </button>
    </div>
  );
}
