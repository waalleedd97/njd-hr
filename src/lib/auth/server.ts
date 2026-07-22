import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/navigation";
import type { UserProfile } from "./types";

const LANDING_URL = "https://njd-services.net";

const FALLBACK_ADMIN_EMAILS = new Set([
  "waleed@njdstudio.net",
  "salman@njdstudio.net",
]);

export interface ServerSession {
  supabaseUserId: string;
  user: UserProfile;
  role: UserRole;
}

/**
 * Resolves the current authenticated user on the server.
 * Wrapped with React's `cache()` so layout + page share one DB round-trip.
 */
export const getServerUser = cache(async (): Promise<ServerSession | null> => {
  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    return null;
  }

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user?.email) return null;

  const authUser = userRes.user;
  const email = authUser.email!;
  const userId = authUser.id;

  // App access gate: has_app_access(uid, "hr") — redirect on explicit false.
  // Fail-open on RPC error so a transient failure doesn't lock everyone out.
  // NB: redirect() throws NEXT_REDIRECT, so it must stay outside try/catch.
  let hasAccess: boolean | null = null;
  let accessErr: unknown = null;
  try {
    const res = await supabase.rpc("has_app_access", { uid: userId, app: "hr" });
    hasAccess = res.data as boolean | null;
    accessErr = res.error;
  } catch (err) {
    accessErr = err;
  }
  if (accessErr) {
    console.error(
      "[auth] has_app_access RPC failed (fail-open):",
      accessErr instanceof Error ? accessErr.message : accessErr
    );
  } else if (hasAccess === false) {
    redirect(LANDING_URL);
  }

  const [roleRes, profRes] = await Promise.allSettled([
    supabase.rpc("get_user_role", { uid: userId }),
    supabase
      .from("profiles")
      .select(
        "name_ar,name_en,full_name_ar,full_name_en,job_title_ar,job_title_en,profile_completed,department"
      )
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const roleData =
    roleRes.status === "fulfilled" ? (roleRes.value as { data?: string }).data : null;
  const prof =
    profRes.status === "fulfilled"
      ? (profRes.value as { data?: Record<string, unknown> }).data
      : null;

  const isSuperAdmin = roleData === "super_admin";
  const deptIsHr =
    typeof prof?.department === "string" && prof.department === "hr";
  const role: UserRole =
    isSuperAdmin || deptIsHr || FALLBACK_ADMIN_EMAILS.has(email)
      ? "admin"
      : "employee";

  const nameAr =
    (prof?.full_name_ar as string) ||
    (prof?.name_ar as string) ||
    email.split("@")[0];
  const nameEn =
    (prof?.full_name_en as string) ||
    (prof?.name_en as string) ||
    email.split("@")[0];
  const positionAr =
    (prof?.job_title_ar as string) ||
    (role === "admin" ? "مدير النظام" : "موظف");
  const positionEn =
    (prof?.job_title_en as string) ||
    (role === "admin" ? "System Administrator" : "Employee");

  const initialsSrc = nameEn || nameAr;
  const initials = initialsSrc ? initialsSrc.trim().charAt(0).toUpperCase() : "?";

  const user: UserProfile = {
    id: userId,
    localId: userId.slice(0, 8).toUpperCase(),
    nameAr,
    nameEn,
    positionAr,
    positionEn,
    initials,
    email,
    profileCompleted: (prof?.profile_completed as boolean | undefined) ?? false,
  };

  return { supabaseUserId: userId, user, role };
});

/**
 * For pages that must be authenticated. Redirects to Landing if unauth'd.
 * Optionally enforces admin role.
 */
export async function requireUser(options?: {
  admin?: boolean;
}): Promise<ServerSession> {
  const session = await getServerUser();
  if (!session) redirect(LANDING_URL);
  if (options?.admin && session.role !== "admin") redirect("/");
  return session;
}
