import { requireUser } from "@/lib/auth/server";
import { fetchRequestsSlice } from "@/lib/data/server";
import { RequestsView } from "./requests-view";

export default async function RequestsPage() {
  await requireUser();
  const slice = await fetchRequestsSlice();
  return <RequestsView initialSlice={slice} />;
}
