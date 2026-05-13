import { requireUser } from "@/lib/auth/server";
import { fetchEmployeesSlice } from "@/lib/data/server";
import { EmployeeDetailView } from "./employee-detail-view";

/**
 * Dedicated employee detail page. Replaces the previous in-list dialog so
 * the admin gets a real URL they can bookmark, share, and open in a new tab —
 * and so the page can grow features (history, audit trail, edit forms) over
 * time without making the dialog harder to navigate.
 *
 * Reuses fetchEmployeesSlice because the detail view also needs the full
 * employee list (for the manager dropdown) and the assets list (for the
 * issued-assets summary). The single-record lookup happens client-side via
 * the `id` URL param.
 */
export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser({ admin: true });
  const { id } = await params;
  const slice = await fetchEmployeesSlice();
  return <EmployeeDetailView initialSlice={slice} employeeId={id} />;
}
