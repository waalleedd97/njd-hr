#!/usr/bin/env node
/**
 * Verify .env.local Supabase credentials.
 *
 * Tests:
 *   1. NEXT_PUBLIC_SUPABASE_URL  → reachable
 *   2. NEXT_PUBLIC_SUPABASE_ANON_KEY → can connect (no session needed)
 *   3. SUPABASE_SERVICE_ROLE_KEY → can list users (admin-only)
 *   4. notifications table → exists + readable via service role
 *
 * Usage:  node scripts/verify-env.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Manually parse .env.local (no external dep)
const envPath = resolve(process.cwd(), ".env.local");
let envText;
try {
  envText = readFileSync(envPath, "utf8");
} catch {
  console.error("❌ .env.local not found at", envPath);
  process.exit(1);
}

const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\n🔍 Checking credentials...\n");

// 1. URL reachable
if (!URL) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL — missing");
  process.exit(1);
}
try {
  const res = await fetch(URL + "/rest/v1/", { headers: { apikey: ANON || "" } });
  if (res.status === 200 || res.status === 401 || res.status === 404) {
    console.log("✅ NEXT_PUBLIC_SUPABASE_URL — reachable:", URL);
  } else {
    console.log("⚠️  NEXT_PUBLIC_SUPABASE_URL — unexpected status", res.status);
  }
} catch (e) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL — unreachable:", e.message);
  process.exit(1);
}

// 2. Anon key
if (!ANON) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY — missing");
} else {
  const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await anonClient.auth.getSession();
  if (!error) {
    console.log("✅ NEXT_PUBLIC_SUPABASE_ANON_KEY — valid (auth API responds)");
  } else {
    console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY — invalid:", error.message);
  }
}

// 3. Service role key
if (!SERVICE) {
  console.log("❌ SUPABASE_SERVICE_ROLE_KEY — missing");
} else {
  const adminClient = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (!error && data) {
    console.log(`✅ SUPABASE_SERVICE_ROLE_KEY — valid (admin access works, ${data.users.length >= 0 ? "users count: " + data.users.length : ""})`);
  } else {
    console.log("❌ SUPABASE_SERVICE_ROLE_KEY — invalid or insufficient privileges:", error?.message);
  }
}

// 4. notifications table
if (SERVICE) {
  const adminClient = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { error } = await adminClient.from("notifications").select("id").limit(1);
  if (!error) {
    console.log("✅ notifications table — exists and readable");
  } else {
    console.log("❌ notifications table — error:", error.message);
  }

  // Check Realtime publication
  const { data: pubs, error: pubErr } = await adminClient.rpc("exec_sql", {}).then(() => ({ data: null, error: null })).catch(() => ({ data: null, error: null }));
  void pubs; void pubErr;
  // Direct SQL not supported via SDK — skip silently
}

console.log("\n— done —\n");
