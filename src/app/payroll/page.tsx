import { requireUser } from "@/lib/auth/server";
import { fetchPayrollSlice } from "@/lib/data/server";
import { PayrollView } from "./payroll-view";

export default async function PayrollPage() {
  await requireUser();
  const slice = await fetchPayrollSlice();
  return <PayrollView initialSlice={slice} />;
}
