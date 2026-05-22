import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { FlashcardsClient } from "@/components/FlashcardsClient";

export const dynamic = "force-dynamic";

export default async function FlashcardsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const cards = await prisma.flashcard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <FlashcardsClient
      initialCards={cards.map((c) => ({
        id: c.id,
        hanzi: c.hanzi,
        pinyin: c.pinyin,
        definition: c.definition,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
