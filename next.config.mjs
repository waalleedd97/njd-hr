import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supabase project host for CSP (must match NEXT_PUBLIC_SUPABASE_URL host)
const SUPABASE_HOSTS = "https://*.supabase.co wss://*.supabase.co";
const LANDING_ORIGIN = "https://njd-services.net";
const FONTS_ORIGINS = "https://fonts.googleapis.com https://fonts.gstatic.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${LANDING_ORIGIN}`,
  `style-src 'self' 'unsafe-inline' ${FONTS_ORIGINS}`,
  `font-src 'self' ${FONTS_ORIGINS}`,
  `img-src 'self' data: blob: https://*.supabase.co ${LANDING_ORIGIN}`,
  `connect-src 'self' ${SUPABASE_HOSTS} ${LANDING_ORIGIN}`,
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
