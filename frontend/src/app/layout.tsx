import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "世界 · Shìjiè",
  description: "Read Chinese, build flashcards, play a daily image-description game.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="hanzi text-2xl font-bold leading-none">
                  世界
                </span>
                <span className="text-sm text-ink/60">Shìjiè</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link className="rounded px-3 py-1.5 hover:bg-ink/5" href="/">
                  Reader
                </Link>
                <Link
                  className="rounded px-3 py-1.5 hover:bg-ink/5"
                  href="/flashcards"
                >
                  Flashcards
                </Link>
                <Link
                  className="rounded px-3 py-1.5 hover:bg-ink/5"
                  href="/daily"
                >
                  Daily
                </Link>
                <UserMenu
                  user={
                    session?.user
                      ? {
                          name: session.user.name,
                          email: session.user.email,
                          image: session.user.image,
                        }
                      : null
                  }
                />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
