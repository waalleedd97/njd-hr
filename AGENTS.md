# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

NJD HR is a bilingual (Arabic/English) internal HR management portal for NJD Games. Part of the NJD Services ecosystem:

- **HR Portal** (this repo): `hr.njd-services.net`
- **Landing Page**: `njd-services.net` (auth, profiles, admin panel)
- **Board**: `board.njd-services.net`

All three apps share authentication, theming, language, and the njd-navbar web component.

## Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build (also serves as type/lint check; no test suite exists)
- `npm run lint` — ESLint
- Path alias: `@/*` maps to `./src/*`

## Tech Stack

| Layer | Detail |
|-------|--------|
| Framework | Next.js 14.2.35, App Router, all Client Components |
| Language | TypeScript 5 |
| CSS | Tailwind CSS 3.4.1, dark mode via `class` strategy |
| UI | @base-ui/react 1.3.0 + class-variance-authority 0.7.1 (shadcn pattern) |
| Theme | next-themes 0.4.6 |
| Icons | lucide-react 0.577.0 + custom 3D SVG module icons |
| Backend | Supabase 2.99.1 (auth, DB, storage, realtime) |
| Email | Resend 6.9.3 |
| PDF | jspdf 4.2.0 |
| Package manager | npm |
| Deployment | Vercel |

## Supabase Configuration

Auth and all shared tables live in the **Supabase Landing project** (`iauulqfgrbegwcnfatmx`). This HR app connects to that same project for everything:

- **Auth**: Handled entirely by the Landing Page. HR never renders a login form — unauthenticated users are redirected to `njd-services.net`.
- **Shared tables**: `profiles`, `user_roles`, `app_access`, `departments`, `notifications`, `daily_reports`
- **Storage buckets**: `daily-reports` (private, for end-of-day report attachments)
- **RPC functions**: `get_user_role(uid)`, `has_app_access(uid, app)`, `is_super_admin(uid)`, `admin_list_users()`

### Session Recovery Flow (`src/components/supabase-auth-guard.tsx`)

1. Check URL hash for `access_token` + `refresh_token` (OAuth/magic-link callback)
2. Try `supabase.auth.getSession()`
3. If null → read `njd-rt` cookie (cross-subdomain refresh token on `.njd-services.net`) and call `refreshSession()`
4. If still null → wait for `onAuthStateChange` with 3-second timeout
5. If still null → redirect to `https://njd-services.net`
6. Check `has_app_access(uid, "hr")` — redirect on explicit `false`

### Email Access Rules

- `@njdstudio.net` emails → auto-registered
- Other emails → must exist in `allowed_emails` table

## RBAC (Role-Based Access Control)

| Role | Access |
|------|--------|
| `super_admin` | Full access to all modules |
| `employee` | Own data only (attendance, leaves, requests, payroll view) |

- Role is fetched via `get_user_role(uid)` RPC; falls back to email-based check (`hr` department = admin)
- **Admin users**: `waleed@njdstudio.net`, `salman@njdstudio.net`
- Admin-only paths: `/employees`, `/daily-reports`, `/reports`, `/settings`
- `AppShell` redirects employees away from admin routes after 1.5s delay

## Provider Stack

```
NextThemeProvider
  └─ SupabaseAuthGuard         // redirects if no session
    └─ LanguageProvider        // lang (ar/en), dir (rtl/ltr), t
      └─ AuthProvider          // role, user, isAuthenticated
        └─ DataProvider        // all app state, persisted to localStorage
```

- **LanguageProvider** — `useLanguage()` hook, reads `njd-lang` from localStorage
- **AuthProvider** — `useAuth()` hook, syncs from Supabase session, persists to `localStorage("njd-hr-auth")`
- **DataProvider** — `useData()` hook, centralized state with hydration pattern, persists to `localStorage("njd-hr-data")`

## Shared Components

### njd-navbar.js

- Hosted at `https://njd-services.net/njd-navbar.js`, loaded as a Web Component via `next/script`
- **Any changes to the navbar go to the Landing Page project, NOT this repo**
- Custom events: `njd-logout`, `njd-lang-change`, `njd-notification-click`
- Attributes: `lang`, `app="hr"`, `user-name`, `notification-count`
- `auth="false"` hides user info; `notification-count` sets bell badge number

### Theme & Language Sync

- **Theme**: `njd-theme` cookie on `.njd-services.net` → read before framework loads via `<script>` in `<head>`
- **Language**: `njd-lang` cookie on `.njd-services.net` → synced to localStorage on page load
- Both cookies must be read BEFORE localStorage for consistency across subdomains

## Loading Screen

Unified loading animation shared across all 3 NJD apps:

- CSS variables: `--njd-loader-bg`, `--njd-loader-icon`, `--njd-loader-shadow`
- Keyframes: `njd-logo-vis`, `njd-car-vis`, `njd-bounce-cycle`, `njd-shadow-cycle`
- Animation: "NJD" text + drift car SVG morph with bounce effect
- Theme detection script in `<head>` reads `njd-theme` cookie before any framework JS
- Dismiss: `.fade-out` class → `transitionend` event → `remove()` from DOM
- **DO NOT modify the loading screen without explicit instruction**

## HR Features

### Attendance (`src/app/attendance/page.tsx`)

- Check-in/out with geofencing via Haversine distance calculation
- Office location: `24.787278, 46.614306` (NJD Games HQ, Riyadh), 1km radius
- Earliest check-in: **6:00 AM KSA** (Asia/Riyadh timezone)
- Late reference time: **10:00 AM KSA**
- `locationRequired` per employee — admin controls from Landing Page admin panel
- Remote employees (`locationRequired = false`) are **exempt from all penalties**

### Penalty Rules (Late Arrival — relative to 10:00 AM)

| Condition | Deduction |
|-----------|-----------|
| 10:01–10:15 AM (1–15 min late) | No penalty (grace period) |
| 10:16–10:30 AM (16–30 min late) | Warning only |
| 10:31–11:00 AM (31–60 min late) | 5% of daily salary |
| After 11:00 AM (>60 min late) | 10% of daily salary |
| Absent without excuse | Full day deduction (100%) |

### Penalty Rules (Early Departure)

| Condition | Deduction |
|-----------|-----------|
| 1–15 min early | No penalty |
| 16–30 min early | Warning only |
| 31–60 min early | 5% of daily salary |
| >60 min early | 10% of daily salary |
| No checkout recorded | Full day deduction until corrected (100%) |

Daily salary = gross salary / 30

### Payroll (`src/app/payroll/page.tsx`)

- Payroll date: **27th of each month**
  - If 27th falls on Friday → **26th (Thursday)**
  - If 27th falls on Saturday → **28th (Sunday)**
- GOSI: Employee share **9.75%** of basic salary, Company share **12.25%**
- Net = Basic + Housing + Transport + Other - GOSI - Penalties - Advance deductions

### Leave Management (`src/app/leaves/page.tsx`)

- Default balances: Annual **21 days**, Sick **10 days**, Unpaid **30 days**
- Additional types: Marriage, Paternity
- Balances update only on approval, not on submission
- Admin tabs: Balance | Requests | Team Calendar
- Employee tabs: Balance | Requests

### Daily Reports (`src/app/daily-reports/page.tsx` + attendance checkout)

- **Mandatory popup on checkout** — employee must submit report before clock-out completes
- Content: text + up to **5 file attachments**, max **10MB each**
- Accepted file types: images, video, PDF, Office docs, ZIP
- Storage: `daily_reports` table + `daily-reports` Supabase Storage bucket
- Path: `{userId}/{date}/{filename}`
- Admin page shows all reports by date with submitted/missing filtering

### Notifications (`src/lib/notifications.ts` + `src/components/layout/notifications-panel.tsx`)

- Dual stream: in-app (localStorage) + Supabase (persistent, realtime)
- Types: `leave`, `request`, `payroll`, `attendance`, `system`
- Supabase Realtime subscription for instant push
- Browser push notifications via Service Worker (`public/sw.js`)

### Employee Invitations (`src/app/employees/page.tsx` + `src/app/api/invite/route.ts`)

- Admin sends invitation → email via Resend API → employee clicks link → auto-registers
- Default password for invited employees: `demo123`
- Profile completion required on first login

## i18n

- All strings in `src/lib/i18n.ts` as `translations.ar` / `translations.en`
- Access: `useLanguage().t`
- Every user-facing string **must** have both Arabic and English entries
- Font: Tajawal (Arabic + Latin subsets, weights 200–900)

## RTL-Safe Positioning

**Never use `right-*` or `left-*` for directional positioning** on absolute/fixed elements:

- `end-*` instead of `right-*` (maps to right in LTR, left in RTL)
- `start-*` instead of `left-*` (maps to left in LTR, right in RTL)
- `pe-*` / `ps-*` instead of `pr-*` / `pl-*`
- `me-*` / `ms-*` instead of `mr-*` / `ml-*`
- Exception: centering patterns like `left-1/2 -translate-x-1/2` are direction-neutral and OK

Dialog/Sheet headers include `pe-8` / `pe-12` padding to prevent overlap with close buttons.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (pages) | `page.tsx` in route folder | `src/app/leaves/page.tsx` |
| Files (components) | kebab-case | `mobile-nav.tsx`, `app-shell.tsx` |
| Files (lib) | kebab-case | `data-store.tsx`, `mock-data.ts` |
| React components | PascalCase | `AppShell`, `MobileNav`, `DataProvider` |
| Hooks | camelCase with `use` prefix | `useLanguage()`, `useAuth()`, `useData()` |
| Context | PascalCase + `Context` | `LanguageContext`, `AuthContext`, `DataContext` |
| State variables | camelCase | `clockedIn`, `dialogOpen`, `searchQuery` |
| CSS classes | Tailwind utilities + custom `.glass-card`, `.hover-lift`, `.njd-gradient-fill` |
| IDs (generated) | Prefix + counter | `LR1001`, `REQ1002`, `ADV1003`, `ADJ1004`, `INV1005`, `N1006`, `EMP1007` |
| Translation keys | camelCase, nested by module | `t.nav.dashboard`, `t.lev.annual`, `t.common.save` |
| Department keys | kebab-case | `software-dev`, `game-dev`, `project-mgmt` |

## Strict Rules

1. **Western Arabic numerals ONLY** (0-9). NEVER use Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) anywhere in the codebase. Use locale `ar-SA-u-nu-latn` for Arabic number formatting.
2. **All SQL migrations** run in Supabase Landing project (`iauulqfgrbegwcnfatmx`), not locally.
3. **Edge Functions** deploy via: `cd '/Users/waleed97/Downloads/NJD Services Landing Page' && npx supabase functions deploy [name]`
4. **njd-navbar.js** is the single source of truth for the navbar. Do NOT create a local navbar component.
5. **Profile page** lives in Landing Page (`njd-services.net/#profile`). Do NOT build a local profile page. The `/profile/complete` route in this repo is only for first-time profile completion of invited employees.
6. **DO NOT modify the loading screen** (CSS variables `--njd-loader-*`, keyframes `njd-*`, the `.njd-loader` HTML block) without explicit instruction.
7. **Supabase is the single source of truth for ALL business data** — attendance, leave requests, employee requests, salary advances, attendance adjustments, pending invitations, leave balances. localStorage stores ONLY settings and UI preferences (theme, language). All CRUD operations write to Supabase first, then refresh local React state as cache. Never fall back to localStorage for business data.

## Common Pitfalls

1. **`getSession()` returns null on subdomains** — must read `njd-rt` cookie manually and call `refreshSession()`. The full recovery chain is in `supabase-auth-guard.tsx`.
2. **Tailwind v4 dark mode**: use `:where(.dark, .dark *)` not `:is(.dark *)` to avoid specificity issues.
3. **Cookie size**: keep under 4KB or browser silently deletes it.
4. **Always read `njd-theme` and `njd-lang` cookies before localStorage** — cookies are the cross-subdomain source of truth.
5. **`detectSessionInUrl: false`** is set in the Supabase client config — URL hash tokens are handled manually in the auth guard.
6. **Hydration mismatch**: DataProvider uses a hydration pattern (`hydrated` state) — don't render data-dependent UI before hydration completes.
7. **`location_required` must always be fetched fresh from the Supabase `profiles` table** — never read from localStorage, DataProvider, or mock data. The admin controls this setting from the Landing Page admin panel, so cached values would be stale. Attendance page fetches it via `session.user.id`; employees page resolves the Supabase UUID via `admin_list_users` RPC first.

## Project Structure

```
NJD HR/
├── public/
│   ├── logo.png                    # Company logo
│   ├── favicon.ico                 # Browser favicon
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   └── sw.js                       # Service Worker for push notifications
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (font, loading screen, theme script, providers)
│   │   ├── page.tsx                # Dashboard (admin: stats + all requests; employee: own data)
│   │   ├── loading.tsx             # Route loading skeleton
│   │   ├── globals.css             # CSS variables, dark mode, custom utilities
│   │   ├── api/invite/route.ts     # POST — send invitation email via Resend
│   │   ├── attendance/page.tsx     # Clock in/out, geofence, daily report, adjustments
│   │   ├── daily-reports/page.tsx  # Admin: view all employee daily reports by date
│   │   ├── employees/page.tsx      # Admin: employee list, profiles, invitations
│   │   ├── leaves/page.tsx         # Leave balances, requests, team calendar
│   │   ├── payroll/page.tsx        # Payroll table, GOSI, WPS, advances, payslips
│   │   ├── reports/page.tsx        # Admin: workforce analytics
│   │   ├── requests/page.tsx       # Request management (all types)
│   │   ├── settings/page.tsx       # Admin: 9-tab settings (depts, geofence, penalties, etc.)
│   │   └── profile/
│   │       ├── page.tsx            # Redirects to Landing Page profile
│   │       └── complete/page.tsx   # First-time profile completion for invited employees
│   ├── components/
│   │   ├── providers.tsx           # LanguageProvider + AuthProvider + combined Providers
│   │   ├── supabase-auth-guard.tsx # Session recovery + app access check
│   │   ├── layout/
│   │   │   ├── app-shell.tsx       # Main shell (navbar bridge, sidebar, route protection)
│   │   │   ├── sidebar.tsx         # Desktop sidebar navigation
│   │   │   ├── mobile-nav.tsx      # Mobile bottom navigation
│   │   │   ├── language-toggle.tsx # 3D globe language switcher
│   │   │   └── notifications-panel.tsx # Notification dropdown with realtime
│   │   ├── icons/
│   │   │   └── module-icons.tsx    # 9 custom 3D SVG module icons
│   │   └── ui/                     # 16 shadcn/base-ui components
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       └── tooltip.tsx
│   └── lib/
│       ├── data-store.tsx          # DataProvider: all state + actions + localStorage persistence
│       ├── mock-data.ts            # Types, seed data, penalty rules, geofence config, GOSI_RATE
│       ├── i18n.ts                 # All translations (ar/en), Language type
│       ├── navigation.ts           # Route definitions, admin-only filtering
│       ├── notifications.ts        # Supabase notification CRUD + push subscription
│       ├── supabase.ts             # Supabase client singleton
│       └── utils.ts                # cn(), getLocale(), formatDate(), formatNumber()
├── supabase/
│   ├── schema.sql                  # Full DB schema (reference only — runs in Landing project)
│   └── migrations/
│       └── 003_daily_reports.sql   # Daily reports table + storage bucket + RLS
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
└── components.json                 # shadcn configuration
```

## Key File Paths

| File | Purpose |
|------|---------|
| `src/components/providers.tsx` | Language + Auth contexts, Supabase session sync, role resolution |
| `src/components/supabase-auth-guard.tsx` | Session recovery chain (hash → getSession → cookie → listener) |
| `src/lib/data-store.tsx` | Central state management: 13 data collections, 25+ actions, localStorage persistence |
| `src/lib/mock-data.ts` | All TypeScript interfaces, seed data, penalty rules, GOSI_RATE (0.0975), geofence config |
| `src/lib/i18n.ts` | Complete translation dictionary (ar/en) for every UI string |
| `src/lib/navigation.ts` | Route definitions, `getNavForRole()`, `adminOnlyPaths` |
| `src/lib/notifications.ts` | Supabase notification CRUD, push subscription, preferences |
| `src/components/layout/app-shell.tsx` | Main layout: njd-navbar bridge, sidebar, route protection |
| `src/app/layout.tsx` | Root layout: Tajawal font, loading screen, theme script, cookie sync |
| `src/app/globals.css` | CSS variables (light/dark), NJD design tokens, custom utility classes |
| `supabase/schema.sql` | Full database schema (reference — actual schema lives in Landing project) |
