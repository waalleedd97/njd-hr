import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Use the same Landing project credentials as the browser client.
// Do not prefer env overrides here, otherwise the route can authenticate
// against a different Supabase project than the rest of the HR app.
const SUPABASE_URL = "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";
const ADMIN_EMAILS = new Set([
  "waleed@njdstudio.net",
  "salman@njdstudio.net",
]);
const ALLOWED_TYPES = new Set([
  "leave",
  "request",
  "payroll",
  "attendance",
  "system",
]);

type AdminNotificationPayload = {
  type: "leave" | "request" | "payroll" | "attendance" | "system";
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
};

function isSchemaMismatchError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.message?.includes("column") === true ||
    error.message?.includes("schema cache") === true
  );
}

function buildNotificationRows(
  adminIds: string[],
  body: AdminNotificationPayload
) {
  const contentVariants = [
    (adminId: string) => ({
      user_id: adminId,
      title_ar: body.titleAr,
      title_en: body.titleEn,
      body_ar: body.descAr,
      body_en: body.descEn,
    }),
    (adminId: string) => ({
      user_id: adminId,
      title_ar: body.titleAr,
      title_en: body.titleEn,
      desc_ar: body.descAr,
      desc_en: body.descEn,
    }),
  ];
  const linkVariants = [
    { link: body.href || null },
    { href: body.href || null },
  ];
  const readVariants = [{ is_read: false }, { read: false }];
  const typeVariants = [{}, { type: body.type }];
  const appVariants = [{ app_name: "hr" }, {}];

  const rowSets: Array<Array<Record<string, unknown>>> = [];
  for (const appVariant of appVariants) {
    for (const contentVariant of contentVariants) {
      for (const linkVariant of linkVariants) {
        for (const readVariant of readVariants) {
          for (const typeVariant of typeVariants) {
            rowSets.push(
              adminIds.map((adminId) => ({
                ...contentVariant(adminId),
                ...appVariant,
                ...linkVariant,
                ...readVariant,
                ...typeVariant,
              }))
            );
          }
        }
      }
    }
  }
  return rowSets;
}

async function insertNotifications(
  adminClient: SupabaseClient,
  rowsList: Array<Array<Record<string, unknown>>>
) {
  let error: { message?: string; code?: string } | null = null;
  for (const rows of rowsList) {
    const result = await adminClient
      .from("notifications")
      .insert(rows as never[]);
    error = result.error;
    if (!error) break;
    if (!isSchemaMismatchError(error)) break;
  }
  return { error };
}

async function resolveAdminUserIds(
  adminClient: SupabaseClient
) {
  const adminIds = new Set<string>();

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role_name", "super_admin");

  if (!roleError) {
    const roleUserIds = ((roleRows || []) as Array<{ user_id: string }>)
      .map((row) => row.user_id)
      .filter(Boolean);

    const roleLookups = await Promise.all(
      roleUserIds.map(async (userId) => {
        const { data, error } = await adminClient.auth.admin.getUserById(userId);
        return !error && data.user ? data.user.id : null;
      })
    );

    for (const userId of roleLookups) {
      if (userId) adminIds.add(userId);
    }
  }

  const { data: usersData, error: usersError } =
    await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (!usersError) {
    for (const user of usersData.users) {
      if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
        adminIds.add(user.id);
      }
    }
  }

  return adminIds;
}

export async function POST(req: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    let body: AdminNotificationPayload;
    try {
      body = (await req.json()) as AdminNotificationPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body?.type ||
      !ALLOWED_TYPES.has(body.type) ||
      !body.titleAr ||
      !body.titleEn ||
      !body.descAr ||
      !body.descEn
    ) {
      return NextResponse.json(
        { error: "Missing or invalid notification payload" },
        { status: 400 }
      );
    }

    if (body.href !== undefined && typeof body.href !== "string") {
      return NextResponse.json({ error: "Invalid href" }, { status: 400 });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const adminIds = await resolveAdminUserIds(adminClient);
    if (adminIds.size === 0) {
      return NextResponse.json(
        { error: "No super admin recipients found" },
        { status: 404 }
      );
    }

    const rowCandidates = buildNotificationRows(Array.from(adminIds), body);
    const { error } = await insertNotifications(adminClient, rowCandidates);
    if (error) {
      console.error("[HR] admin notifications insert error:", error.message);
      return NextResponse.json(
        { error: error.message || "Failed to create admin notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipients: adminIds.size,
    });
  } catch (error) {
    console.error("[HR] admin notifications route error:", error);
    return NextResponse.json(
      { error: "Unexpected notification error" },
      { status: 500 }
    );
  }
}
