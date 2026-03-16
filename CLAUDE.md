# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build (also serves as type/lint check; no test suite exists)
- `npm run lint` — ESLint
- Path alias: `@/*` maps to `./src/*`

## Architecture

NJD HR is a bilingual (Arabic/English) HR management portal for NJD Games, built with Next.js 14 App Router. All pages are Client Components — there is no SSR or API routes.

### Provider Stack (src/components/providers.tsx + src/lib/data-store.tsx)

Providers compose in this order in the root layout:

```
NextThemeProvider → LanguageProvider → AuthProvider → DataProvider → Children
```

- **LanguageProvider** — manages `language` (ar/en), `dir` (rtl/ltr), exposes translation object `t`. Hook: `useLanguage()`
- **AuthProvider** — email-based login, role derived from employee's department (HR dept → admin). Persists to `localStorage("njd-hr-auth")`. Hook: `useAuth()`
- **DataProvider** — centralized app state (employees, attendance, leaves, requests, payroll, etc.). Persists to `localStorage("njd-hr-data")`. Uses hydration pattern to avoid SSR mismatch. Hook: `useData()`

### Routing & Access Control (src/lib/navigation.ts + src/components/layout/app-shell.tsx)

- `navItems` array defines all routes; items flagged `adminOnly: true` are filtered by `getNavForRole()`
- Admin-only paths: `/employees`, `/payroll`, `/requests`, `/reports`, `/settings`
- AppShell renders LoginScreen when unauthenticated; redirects non-admins away from admin routes

### i18n (src/lib/i18n.ts)

All UI strings live in `translations.ar` / `translations.en`. Access via `useLanguage().t`. Every user-facing string must have both Arabic and English entries. The app uses the Tajawal font for Arabic/Latin support with full RTL layout.

### Data Layer

Currently **localStorage-only** with mock data seeding (src/lib/mock-data.ts). A Supabase schema exists at `supabase/schema.sql` but is not wired up — the Supabase client in `src/lib/supabase.ts` is initialized but unused. Types are defined inline in `mock-data.ts` and `data-store.tsx`.

### UI

- shadcn/ui components in `src/components/ui/`
- Custom 3D SVG module icons in `src/components/icons/module-icons.tsx`
- Purple theme with CSS variables in `globals.css`; dark/light mode via next-themes
- Glassmorphism effects (`.glass-card`, `.hover-lift`) defined in globals.css

### RTL-Safe Positioning

This app supports RTL (Arabic). **Never use `right-*` or `left-*` for directional positioning** on absolute/fixed elements. Use logical properties instead:
- `end-*` instead of `right-*` (maps to right in LTR, left in RTL)
- `start-*` instead of `left-*` (maps to left in LTR, right in RTL)
- `pe-*` / `ps-*` instead of `pr-*` / `pl-*` for padding
- `me-*` / `ms-*` instead of `mr-*` / `ml-*` for margin
- Exception: centering patterns like `left-1/2 -translate-x-1/2` are direction-neutral and OK

Dialog/Sheet headers include `pe-8` / `pe-12` padding to prevent overlap with their absolute-positioned close buttons.

### Key Domain Concepts

- **Roles**: `admin` (HR department employees) and `employee` (everyone else) — determined by department, not a separate role field
- **Geofencing**: Attendance clock-in validates GPS proximity using `haversineDistance()` in data-store.tsx
- **Saudi Labor Law compliance**: GOSI rate (9.5%), penalty calculations, public holidays, WPS integration points
- **Request types**: leave requests, salary advances, attendance adjustments, employee invitations — all flow through approval workflows
