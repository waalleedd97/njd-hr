import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Tajawal, Plus_Jakarta_Sans, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { getServerUser } from "@/lib/auth/server";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NJD HR",
  description: "NJD Games HR Management System",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerUser();
  if (!session) redirect("https://njd-services.net");

  // Profile-completion gate — force incomplete profiles onto /profile/complete.
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || "/";
  if (
    session.user.profileCompleted === false &&
    !pathname.startsWith("/profile/complete")
  ) {
    redirect("/profile/complete");
  }

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* NJD Loading Screen CSS */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
:root{--njd-loader-bg:#ffffff;--njd-loader-icon:#111111;--njd-loader-shadow:rgba(0,0,0,0.12)}
.dark{--njd-loader-bg:#0a0a1a;--njd-loader-icon:#ffffff;--njd-loader-shadow:rgba(255,255,255,0.1)}
.njd-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--njd-loader-bg);transition:opacity 0.3s ease-out, visibility 0s linear 0.3s}
html.app-ready .njd-loader{opacity:0;visibility:hidden;pointer-events:none}
.njd-loader .loader-content{display:flex;flex-direction:column;align-items:center;gap:24px}
.njd-loader .morph-container{width:120px;height:120px;position:relative;animation:njd-bounce-cycle 4s ease-in-out infinite}
.njd-loader .morph-container .logo-img,.njd-loader .morph-container .car-svg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:opacity 0.25s ease}
.njd-loader .logo-img .njd-text{font-family:'Arial Black','Helvetica Neue',sans-serif;font-size:42px;font-weight:900;letter-spacing:6px;color:var(--njd-loader-icon);user-select:none}
.njd-loader .car-svg svg{width:100px;height:auto}
.njd-loader .car-svg svg path,.njd-loader .car-svg svg circle,.njd-loader .car-svg svg line,.njd-loader .car-svg svg rect{stroke:var(--njd-loader-icon);fill:none}
.njd-loader .logo-img{animation:njd-logo-vis 4s ease-in-out infinite}
.njd-loader .car-svg{animation:njd-car-vis 4s ease-in-out infinite}
.njd-loader .bounce-shadow{width:60px;height:8px;border-radius:50%;background:var(--njd-loader-shadow);animation:njd-shadow-cycle 4s ease-in-out infinite}
@keyframes njd-logo-vis{0%{opacity:1}22%{opacity:1}25%{opacity:0}72%{opacity:0}75%{opacity:1}100%{opacity:1}}
@keyframes njd-car-vis{0%{opacity:0}22%{opacity:0}25%{opacity:1}72%{opacity:1}75%{opacity:0}100%{opacity:0}}
@keyframes njd-bounce-cycle{0%{transform:translateY(0) scale(1)}4%{transform:translateY(-8px) scale(1.02)}8%{transform:translateY(0) scale(1)}12%{transform:translateY(-6px) scale(1.01)}16%{transform:translateY(0) scale(1)}20%{transform:translateY(-5px) scale(1.01)}22%{transform:translateY(0) scale(1)}25%{transform:translateY(-35px) scale(0.85)}28%{transform:translateY(0) scale(1.08)}31%{transform:translateY(-4px) scale(1)}33%{transform:translateY(0) scale(1)}37%{transform:translateY(0) scale(1)}40%{transform:translateY(-8px) scale(1.02)}44%{transform:translateY(0) scale(1)}48%{transform:translateY(-6px) scale(1.01)}52%{transform:translateY(0) scale(1)}56%{transform:translateY(-8px) scale(1.02)}60%{transform:translateY(0) scale(1)}64%{transform:translateY(-5px) scale(1.01)}68%{transform:translateY(0) scale(1)}72%{transform:translateY(0) scale(1)}75%{transform:translateY(-35px) scale(0.85)}78%{transform:translateY(0) scale(1.08)}81%{transform:translateY(-4px) scale(1)}83%{transform:translateY(0) scale(1)}88%{transform:translateY(-4px) scale(1.01)}92%{transform:translateY(0) scale(1)}96%{transform:translateY(-3px) scale(1)}100%{transform:translateY(0) scale(1)}}
@keyframes njd-shadow-cycle{0%{transform:scaleX(1);opacity:0.6}4%{transform:scaleX(0.85);opacity:0.4}8%{transform:scaleX(1);opacity:0.6}22%{transform:scaleX(1);opacity:0.6}25%{transform:scaleX(0.5);opacity:0.2}28%{transform:scaleX(1.2);opacity:0.7}33%{transform:scaleX(1);opacity:0.6}72%{transform:scaleX(1);opacity:0.6}75%{transform:scaleX(0.5);opacity:0.2}78%{transform:scaleX(1.2);opacity:0.7}83%{transform:scaleX(1);opacity:0.6}100%{transform:scaleX(1);opacity:0.6}}
`,
          }}
        />
        {/* Theme detection — before any framework JS to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=document.cookie.match(/njd-theme=(\\w+)/);var t=m?m[1]:null;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}})()`,
          }}
        />
        {/* NJD Design System — vendored locally to avoid the cross-origin
            redirect (njd-services.net → www.njd-services.net) that the
            previous globals.css @import url(...) was paying on every visit.
            no-css-tags warning is a false positive here: this is a static
            shared file from /public served same-origin, not a per-page
            stylesheet that Next.js would otherwise want to bundle. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/njd-design-system.css" />
        {/* Material Symbols Outlined — render hidden by CSS until font loads (avoids flash of raw icon names) */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {/* Mark <html> when Material Symbols font is ready (hides FOUT of raw icon names) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(document.fonts&&document.fonts.load){document.fonts.load('24px "Material Symbols Outlined"').then(function(){document.documentElement.classList.add('fonts-loaded')}).catch(function(){document.documentElement.classList.add('fonts-loaded')});setTimeout(function(){document.documentElement.classList.add('fonts-loaded')},3000)}else{document.documentElement.classList.add('fonts-loaded')}})()`,
          }}
        />
      </head>
      <body className={`${tajawal.variable} ${plusJakartaSans.variable} ${inter.variable} font-sans antialiased`}>
        {/* NJD Loading Screen — rendered by React, hidden via `.app-ready` class on <html> */}
        <div className="njd-loader" aria-hidden="true">
          <div className="loader-content">
            <div className="morph-container">
              <div className="logo-img">
                <span className="njd-text">NJD</span>
              </div>
              <div className="car-svg">
                <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20,42 L25,42 L30,28 L52,26 L62,18 L88,18 L96,28 L100,42 L105,42" />
                  <path d="M52,26 L55,18" />
                  <path d="M30,28 L25,28" />
                  <path d="M60,18 L58,12 L68,12 L66,18" />
                  <line x1="35" y1="42" x2="82" y2="42" />
                  <circle cx="30" cy="46" r="9" strokeWidth="2.5" />
                  <circle cx="30" cy="46" r="3.5" strokeWidth="1.5" />
                  <circle cx="90" cy="46" r="9" strokeWidth="2.5" />
                  <circle cx="90" cy="46" r="3.5" strokeWidth="1.5" />
                  <path d="M55,18 L58,26 L78,26 L88,18 Z" strokeWidth="2" />
                  <line x1="65" y1="32" x2="72" y2="32" strokeWidth="1.8" />
                  <path d="M12,44 Q16,42 20,44" strokeWidth="1.5" opacity="0.5" />
                  <path d="M6,42 Q10,40 14,42" strokeWidth="1.2" opacity="0.3" />
                </svg>
              </div>
            </div>
            <div className="bounce-shadow"></div>
          </div>
        </div>

        {/* Sync shared NJD cookies → localStorage before first render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function g(n){var m=document.cookie.match(new RegExp('(^| )'+n+'=([^;]+)'));return m?decodeURIComponent(m[2]):null}var t=g('njd-theme');if(t){localStorage.setItem('njd-theme',t);localStorage.setItem('theme',t);document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark')}var l=g('njd-lang');if(l){localStorage.setItem('njd-lang',l);document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr'}})()`,
          }}
        />
        {/* Vendored local copy — see public/njd-navbar.js header for sync notes. */}
        <Script src="/njd-navbar.js" strategy="beforeInteractive" />
        <Providers initialUser={session.user} initialRole={session.role}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
