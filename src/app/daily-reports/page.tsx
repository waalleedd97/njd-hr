import { requireUser } from "@/lib/auth/server";
import { fetchDailyReportsSlice } from "@/lib/data/server";
import { getKSADateString } from "@/lib/utils";
import { DailyReportsView } from "./daily-reports-view";

export default async function DailyReportsPage() {
  await requireUser({ admin: true });
  // Business date in Asia/Riyadh — never UTC (toISOString shifts the day near midnight KSA).
  const today = getKSADateString();
  const slice = await fetchDailyReportsSlice(today);
  return <DailyReportsView initialSlice={slice} />;
}
