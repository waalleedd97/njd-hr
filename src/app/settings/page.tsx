import { requireUser } from "@/lib/auth/server";
import { fetchSettingsSlice } from "@/lib/data/server";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  await requireUser({ admin: true });
  const slice = await fetchSettingsSlice();
  return <SettingsView initialSlice={slice} />;
}
