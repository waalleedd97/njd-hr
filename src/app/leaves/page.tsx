import { requireUser } from "@/lib/auth/server";
import { fetchLeavesSlice } from "@/lib/data/server";
import { LeavesView } from "./leaves-view";

export default async function LeavesPage() {
  await requireUser();
  const slice = await fetchLeavesSlice();
  return <LeavesView initialSlice={slice} />;
}
