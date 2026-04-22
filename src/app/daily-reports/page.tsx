import { requireUser } from "@/lib/auth/server";
import { fetchDailyReportsSlice } from "@/lib/data/server";
import { DailyReportsView } from "./daily-reports-view";

export default async function DailyReportsPage() {
  await requireUser({ admin: true });
  const today = new Date().toISOString().split("T")[0];
  const slice = await fetchDailyReportsSlice(today);
  return <DailyReportsView initialSlice={slice} />;
}
