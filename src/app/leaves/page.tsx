import { requireUser } from "@/lib/auth/server";
import { fetchLeavesSlice } from "@/lib/data/server";
import { LeavesView } from "./leaves-view";

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const slice = await fetchLeavesSlice();
  const params = await searchParams;
  return <LeavesView initialSlice={slice} initialTab={params.tab} />;
}
