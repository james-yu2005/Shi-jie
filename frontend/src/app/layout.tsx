import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import { HeaderNav } from "@/components/HeaderNav";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "世界 · Shìjiè — read, save, master Chinese",
  description:
    "Paste Chinese, look up words, build a flashcard bucket, grow a knowledge graph, and practise daily with an AI-graded image game.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
              <Link href="/" className="group flex items-baseline gap-2">
                <span className="hanzi serif text-2xl font-bold leading-none transition group-hover:text-accent">
                  世界
                </span>
                <span className="hidden text-sm text-ink/60 sm:inline">
                  Shìjiè
                </span>
              </Link>
              <div className="flex items-center gap-3">
                <HeaderNav />
                <span className="hidden h-6 w-px bg-ink/10 sm:inline" />
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
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {children}
          </main>

          <footer className="border-t border-ink/10 bg-paper">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-ink/60">
              <span>
                <span className="hanzi serif text-base">世界</span> · a small
                Chinese reading & study app
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
