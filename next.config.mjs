import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin Turbopack root to this project (avoids picking up parent lockfiles)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
