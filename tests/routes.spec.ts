import { test, expect } from "@playwright/test";

/**
 * Comprehensive route scan for NJD HR.
 *
 * The app requires Supabase auth — unauthenticated users will be redirected
 * to njd-services.net by SupabaseAuthGuard. So we test at two levels:
 *
 * 1. HTTP level: Does Next.js serve the route without a 500 error?
 *    (200 or 307 redirect are both acceptable — 500 means crash)
 *
 * 2. Page level: Does the HTML contain expected markers that prove
 *    Next.js compiled and rendered the page without build errors?
 */

const ALL_ROUTES = [
  "/",
  "/attendance",
  "/leaves",
  "/payroll",
  "/requests",
  "/employees",
  "/daily-reports",
  "/reports",
  "/settings",
  "/profile",
  "/profile/complete",
];

test.describe("Route Health Check — No 500 errors", () => {
  for (const route of ALL_ROUTES) {
    test(`${route} does not return 500`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15000 });
      expect(response).not.toBeNull();
      const status = response!.status();
      // Accept 200 (OK) or 307/308 (redirect to auth) — but NOT 500
      expect(status, `Route ${route} returned ${status}`).not.toBe(500);
    });
  }
});

test.describe("API Route Health Check", () => {
  test("POST /api/invite returns 4xx without body (not 500)", async ({ request }) => {
    const response = await request.post("/api/invite", {
      data: {},
    });
    // Should return 400 (bad request) or similar — NOT 500
    expect(response.status()).not.toBe(500);
  });
});

test.describe("Static Assets", () => {
  const assets = [
    "/logo.png",
    "/favicon.ico",
    "/favicon-32x32.png",
    "/sw.js",
  ];

  for (const asset of assets) {
    test(`${asset} serves correctly`, async ({ request }) => {
      const response = await request.get(asset);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe("Page Content Verification", () => {
  test("Root page contains NJD HR markup", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
    // The page should contain the NJD loading screen or the app shell
    const html = await page.content();
    const hasNJD = html.includes("NJD") || html.includes("njd");
    expect(hasNJD).toBe(true);
  });

  test("Root page has correct HTML lang and dir", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const lang = await page.getAttribute("html", "lang");
    const dir = await page.getAttribute("html", "dir");
    expect(lang).toBe("ar");
    expect(dir).toBe("rtl");
  });

  test("Root page loads font CSS variable", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const html = await page.content();
    // Font is loaded via CSS variable --font-tajawal, check for the variable or font-sans class
    expect(html.includes("font-sans") || html.includes("--font-tajawal") || html.includes("font-family")).toBe(true);
  });

  test("NJD navbar script is loaded", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
    const html = await page.content();
    expect(html.includes("njd-navbar.js")).toBe(true);
  });

  test("Page renders without crash (has body content)", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "load", timeout: 15000 });
    expect(response).not.toBeNull();
    expect(response!.status()).not.toBe(500);
    // Page should have some content in the body
    const bodyText = await page.locator("body").innerText().catch(() => "");
    expect(bodyText.length).toBeGreaterThan(0);
  });
});

test.describe("Next.js Build Integrity", () => {
  test("_next/static chunks are served", async ({ page }) => {
    const responses: number[] = [];
    page.on("response", (resp) => {
      if (resp.url().includes("_next/static")) {
        responses.push(resp.status());
      }
    });
    await page.goto("/", { waitUntil: "networkidle", timeout: 20000 });
    // Should have loaded some JS chunks
    expect(responses.length).toBeGreaterThan(0);
    // None should be 500
    for (const status of responses) {
      expect(status).not.toBe(500);
    }
  });

  test("No console errors on root page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      // Ignore Supabase auth errors (expected without session)
      if (err.message.includes("supabase") || err.message.includes("auth") || err.message.includes("session")) return;
      errors.push(err.message);
    });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
    // Wait a bit for async errors
    await page.waitForTimeout(2000);
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydration") &&
        !e.includes("Supabase") &&
        !e.includes("njd-services") &&
        !e.includes("Failed to fetch")
    );
    expect(criticalErrors, `Console errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });
});
