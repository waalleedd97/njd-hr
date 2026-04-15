import { requireUser } from "@/lib/auth/server";
import { fetchEmployeesSlice } from "@/lib/data/server";
import { EmployeesView } from "./employees-view";

export default async function EmployeesPage() {
  await requireUser({ admin: true });
  const slice = await fetchEmployeesSlice();
  return <EmployeesView initialSlice={slice} />;
}
