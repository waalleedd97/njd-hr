import { requireUser } from "@/lib/auth/server";
import { fetchAttendanceSlice } from "@/lib/data/server";
import { AttendanceView } from "./attendance-view";

export default async function AttendancePage() {
  const session = await requireUser();
  const slice = await fetchAttendanceSlice(session.supabaseUserId);
  return <AttendanceView initialSlice={slice} />;
}
