import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supabase project host for CSP (must match NEXT_PUBLIC_SUPABASE_URL host)
const SUPABASE_HOSTS = "https://*.supabase.co wss://*.supabase.co";
// Landing-Page origins are intentionally NOT in the CSP allow-list: the navbar
// web component is vendored locally at public/njd-navbar.js and the logo is
// served from public/logo.png. Keeping the allow-list empty removes a whole
// class of cross-origin failures (CSP vs Vercel apex-to-www 307 redirect).
const FONTS_ORIGINS = "https://fonts.googleapis.com https://fonts.gstatic.com";

// Optional observability endpoint — added to connect-src when configured
let SENTRY_HOST = "";
try {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    SENTRY_HOST = "https://" + new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).host;
  }
} catch {
  // ignore malformed DSN
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline' ${FONTS_ORIGINS}`,
  `font-src 'self' ${FONTS_ORIGINS}`,
  `img-src 'self' data: blob: https://*.supabase.co`,
  `connect-src 'self' ${SUPABASE_HOSTS} ${SENTRY_HOST}`.trim(),
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
