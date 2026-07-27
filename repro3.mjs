import { chromium } from "@playwright/test";
const SRK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQ4MTkxNTksImV4cCI6MjEwMDE3OTE1OX0.YdL3YGuEZvqAW8n-BQm3Vm3-lMMZpNn6M5d8Gj6Fm-0";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0ODE5MTU5LCJleHAiOjIxMDAxNzkxNTl9.mu1SsmoiUv2eZcH3-Qfck7OSl_Ni9umbdMTVY1fvRUM";
const BASE = "https://db.njd-services.net";
const resp = await fetch(`${BASE}/auth/v1/admin/generate_link`, {
  method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "baraa@njdstudio.net" }),
});
const { action_link } = await resp.json();
const verify = await fetch(action_link, { headers: { apikey: ANON }, redirect: "manual" });
const rt = verify.headers.get("location").match(/refresh_token=([^&]*)/)[1];
const browser = await chromium.launch();
const context = await browser.newContext({ geolocation: { latitude: 24.787278, longitude: 46.614306 }, permissions: ["geolocation"], locale: "en-US" });
await context.addCookies([{ name: "njd-rt", value: rt, domain: ".njd-services.net", path: "/" }]);
const page = await context.newPage();
await page.goto("https://hr.njd-services.net/attendance", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);
console.log("url:", page.url());
console.log("title:", await page.title());
const buttons = await page.locator("button").allTextContents();
console.log("buttons:", JSON.stringify(buttons.map(b => b.trim().slice(0, 40)).filter(Boolean).slice(0, 15)));
