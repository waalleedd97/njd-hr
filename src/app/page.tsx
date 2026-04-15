import { requireUser } from "@/lib/auth/server";
import { fetchDashboardSlice } from "@/lib/data/server";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  await requireUser();
  const slice = await fetchDashboardSlice();
  return <DashboardView initialSlice={slice} />;
}
