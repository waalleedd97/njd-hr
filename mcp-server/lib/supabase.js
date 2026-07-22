// Supabase (service-role) + Resend clients for the NJD HR MCP server.
// Loads environment from the repo-root .env.local (one level up from mcp-server/).
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env.local lives at the Next.js repo root: mcp-server/lib -> mcp-server -> repo root
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `[njd-hr-mcp] متغيرات بيئة مفقودة / Missing environment variables: ${missing.join(", ")}\n` +
      `تأكد من وجودها في .env.local في جذر المشروع / Make sure they exist in the repo-root .env.local`
  );
  process.exit(1);
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export const resend = new Resend(process.env.RESEND_API_KEY);

export const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "NJD Games HR <onboarding@resend.dev>";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://hr.njd-services.net";
