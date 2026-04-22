import { requireUser } from "@/lib/auth/server";
import { fetchReportsSlice } from "@/lib/data/server";
import { ReportsView } from "./reports-view";

export default async function ReportsPage() {
  await requireUser({ admin: true });
  const slice = await fetchReportsSlice();
  return <ReportsView initialSlice={slice} />;
}
