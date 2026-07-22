import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return null;
  }

  return { url, anonKey, serviceRoleKey };
}

export async function POST(req: NextRequest) {
  try {
    // CSRF guard: only accept POSTs whose Origin/Referer match the host we serve.
    // This blocks browser-originated cross-site requests that ride along session cookies.
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host");
    if (origin || referer) {
      const expectedHost = host ? host.toLowerCase() : "";
      const isSameOrigin = (url: string | null) => {
        if (!url) return false;
        try {
          const u = new URL(url);
          return u.host.toLowerCase() === expectedHost;
        } catch {
          return false;
        }
      };
      if (!isSameOrigin(origin) && !isSameOrigin(referer)) {
        return NextResponse.json({ error: "Forbidden: cross-origin request" }, { status: 403 });
      }
    }

    const supabaseEnv = getSupabaseEnv();
    if (!supabaseEnv) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    // Verify the bearer token via the anon client (service role would bypass checks).
    const anonClient = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // No admin check: a user only consumes their OWN invitation — the row is
    // matched by the verified token email, never by client input.
    const adminClient = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: invitation, error: findError } = await adminClient
      .from("pending_invitations")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (findError) {
      console.error("[invitations/accept] lookup failed:", findError.message);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    // Idempotent: no pending invitation for this user — nothing to do.
    if (!invitation) {
      return NextResponse.json({ success: true, already: true });
    }

    const { error: updateError } = await adminClient
      .from("pending_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("[invitations/accept] update failed:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: invitation.id });
  } catch (err) {
    console.error("Invitation accept API error:", err);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
