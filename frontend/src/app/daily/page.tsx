import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DailyClient } from "@/components/DailyClient";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  return <DailyClient />;
}
