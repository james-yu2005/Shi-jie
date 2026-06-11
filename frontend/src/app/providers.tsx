"use client";
import { SessionProvider } from "next-auth/react";
import { LearningPreferencesProvider } from "@/contexts/LearningPreferencesContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LearningPreferencesProvider>{children}</LearningPreferencesProvider>
    </SessionProvider>
  );
}
