import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["waleed@njdstudio.net", "salman@njdstudio.net"];

/**
 * Admin-only employee deletion.
 *
 * Removes the auth user (cascades to profiles, employee_documents,
 * daily_reports, employee_assets, notifications, leaves, requests…),
 * then best-effort purges their storage folders (employee-documents,
 * daily-reports) since storage objects don't cascade.
 *
 * Guards:
 *   - caller must be super_admin (user_roles or ADMIN_EMAILS fallback)
 *   - cannot delete yourself
 *   - cannot delete another super_admin
 */
export async function POST(req: NextRequest) {
  // CSRF: only accept from same origin
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (origin || referer) {
    const expectedHost = host ? host.toLowerCase() : "";
    const isSameOrigin = (url: string | null) => {
      if (!url) return false;
      try {
        return new URL(url).host.toLowerCase() === expectedHost;
      } catch {
        return false;
      }
    };
    if (!isSameOrigin(origin) && !isSameOrigin(referer)) {
      return NextResponse.json({ error: "Forbidden: cross-origin request" }, { status: 403 });
    }
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const targetId = String(body.userId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  const caller = userData.user;

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("user_id", caller.id)
    .eq("role_name", "super_admin")
    .maybeSingle();
  const isAdmin = Boolean(roleRow) || Boolean(
    caller.email && ADMIN_EMAILS.includes(caller.email.toLowerCase())
  );
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  if (targetId === caller.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Protect other super admins from deletion.
  const { data: targetRole } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("user_id", targetId)
    .eq("role_name", "super_admin")
    .maybeSingle();
  if (targetRole) {
    return NextResponse.json({ error: "Cannot delete a super admin account" }, { status: 400 });
  }

  // Best-effort storage purge (storage rows don't cascade with auth.users).
  // Files live two levels deep: {uid}/{type|date}/{filename}.
  const purgeBucket = async (bucket: string) => {
    try {
      const { data: topLevel } = await adminClient.storage.from(bucket).list(targetId);
      const paths: string[] = [];
      for (const entry of topLevel ?? []) {
        const { data: files } = await adminClient.storage.from(bucket).list(`${targetId}/${entry.name}`);
        for (const f of files ?? []) paths.push(`${targetId}/${entry.name}/${f.name}`);
        if (!files || files.length === 0) paths.push(`${targetId}/${entry.name}`);
      }
      if (paths.length > 0) {
        await adminClient.storage.from(bucket).remove(paths);
      }
    } catch (err) {
      console.error(`[employees/delete] storage purge failed for ${bucket}:`, err);
    }
  };
  await purgeBucket("employee-documents");
  await purgeBucket("daily-reports");

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
  if (deleteError) {
    console.error("[employees/delete] deleteUser failed:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
