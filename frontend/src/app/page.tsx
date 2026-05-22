import { Reader } from "@/components/Reader";

export default function HomePage({
  searchParams,
}: {
  searchParams: { text?: string };
}) {
  const initial = searchParams?.text ?? "";
  return <Reader initialText={initial} />;
}
