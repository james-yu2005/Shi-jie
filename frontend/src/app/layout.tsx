import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import { FooterModelInfo } from "@/components/FooterModelInfo";
import { HeaderNav } from "@/components/HeaderNav";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "世界 · Shìjiè — read, save, master Chinese",
  description:
    "Paste Chinese, look up words, build a flashcard bucket, grow a knowledge graph, and practise daily with the daily game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          <header className="site-header sticky top-0 z-30 border-b border-ink/10 bg-paper/85 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="flex items-center justify-between gap-3 py-3">
                <Link href="/" className="group flex shrink-0 items-baseline gap-2">
                  <span className="brand-mark hanzi serif text-2xl font-bold leading-none">
                    世界
                  </span>
                  <span className="hidden text-sm text-ink/60 transition group-hover:text-ink/80 sm:inline">
                    Shìjiè
                  </span>
                </Link>
                <div className="flex items-center gap-2 sm:gap-3">
                  <HeaderNav />
                  <span className="hidden h-6 w-px bg-ink/10 md:inline" />
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
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>

          <footer className="border-t border-ink/10 bg-paper">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-ink/60">
                <span>
                  <span className="hanzi serif text-base">世界</span> · a small
                  Chinese reading & study app
                </span>
              </div>
              <FooterModelInfo />
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
