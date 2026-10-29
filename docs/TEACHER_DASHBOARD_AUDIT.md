# Teacher dashboard — audit (28 Oct 2026)

Branch `perf/teacher-dashboard`. Labels: **MEASURED** · **ESTIMATED** · **NOT MEASURED** · **FIXED** · **OPEN**.

## 1. Architecture and route inventory

Browser SPA (React 18 + Vite, Vercel) talking to Supabase directly (PostgREST/RPC, user JWT, RLS). AI work goes to the
FastAPI backend. Package manager: npm. Router: react-router-dom v6. Styling: Tailwind + one `customStyles` string
inside `TeacherDashboardPage.tsx`.

| Route | Source | Notes |
|---|---|---|
| `/dashboard` (tabs via state) | `src/pages/TeacherDashboardPage.tsx` | Shell + home. Tabs: `dashboard`, `calendar`, `assignments`, `attendance`, `students`, `section` (proctors only), `modules`, `tests` (Test History), `analytics`, `ai-tools`. |
| `/dashboard?tab=assignments` / `tab=modules` | same | deep links handled by a `useEffect` on `location.search`. Other tab names are **not** URL-addressable. |
| `/dashboard/test-generator` | `src/pages/product/...` (lazy) | outside the dashboard shell |
| `/dashboard/analytics` | `AnalyticsPage` | separate page |
| `/contests`, `/join-institute`, `/dashboard/flashcards`, `/settings` | various | linked from the home action tiles |
| `/dashboard/modules` | redirect → `/dashboard?tab=modules` | changed 26 Oct |

Shared: `Icons` object (inline SVGs), `GlossyButton`, `SidebarButton`, `SubscriptionSidebarWidget`, `SidebarHelpWidget`,
`StaticSarthi` (help bot, local answers, no network), `InstituteTeacherPanel`, `TestHistory` (inside the file).

## 2. Data loading (first open, measured earlier this week)

| Request | Why |
|---|---|
| `rpc/get_my_access` | role, institute, scope |
| `profiles` + `coin_transactions` | coins (was loaded 3× → now once) |
| `tests` (own, newest 50) | Test History + monthly count |
| `plans` + `rpc/get_user_plan_status` + `HEAD tests` | plan widget |
| `batches` (scope) | my classes |
| `institute_members` ‖ `institutes` → `departments` → `students` | institute card |

Earlier round: 19 requests with 4 duplicates → 13–15, no duplicates (MEASURED, local production build, stubbed Supabase).

## 3. Visual baseline (before this round)

Captured at 1440, 768 and 390 px for home, Test History, Analytics and Assignments: `docs/screenshots/teacher-dashboard/before/`.

Confirmed defects, in order of visibility:

1. **Rainbow sidebar.** Ten items each with its own colour (blue, indigo, sky, violet, orange, purple, rose, emerald, amber, teal).
2. **Glossy orange gradient tiles** in "What's New" and the hero CTA, with lift/scale hover motion. Not the landing page's language (landing = black primary, coral outline secondary).
3. **Blurred background orbs**: three full-screen `blur-[100px]` layers, plus `backdrop-filter: blur(40px)` on every card (`glass-panel`) and on the sidebar and mobile overlay. Expensive to paint on low-end Android.
4. **Orange "Upgrade" and "Join Institute →" buttons** (inline `#FF7043`), inconsistent with the black primary.
5. **Emoji icon (🏛️)** in the institute card.
6. **Hard-coded analytics claim**: "Students with attendance above 85% achieve … **19.2% higher** than peers with frequent absences" (`TeacherAnalyticsTab.tsx`). Not computed from any data. **Fabricated metric.**
7. Hero "Create Test Papers in Minutes." sits in a large card with a large empty area above the heading on desktop.
8. **Test History (desktop, 1440 px):** the title column is squeezed to ~90 px ("Chapt…") by the row of action buttons (Preview, Paper PDF, Answer Key, DOCX, Check copies, ⋯). **OPEN.**
9. **Phone (390 px):** the floating help-bot bubble sits on top of the last action buttons in Test History and cannot be scrolled past. **OPEN.**
10. Dark mode: not audited this round. **NOT MEASURED.**

No horizontal page overflow at any tested width before the change (0 px at 1440/768/390 for all four tabs).

## 4. Confirmed issues, severity

| # | Issue | Severity | Status |
|---|---|---|---|
| A1 | Hard-coded "19.2% higher" analytics claim | High (misleading data) | **FIXED** — banner removed |
| A2 | Full-screen blur layers + backdrop-filter on cards/sidebar | Medium (paint cost, low-end devices) | **FIXED** — removed; runtime paint cost NOT MEASURED |
| A3 | Rainbow sidebar, glossy gradient tiles, lift motion | Medium (design consistency) | **FIXED** |
| A4 | Orange CTA/buttons inconsistent with landing black primary | Low | **FIXED** (Upgrade, Join Institute, hero CTA) |
| A5 | Emoji used as an icon in the institute card | Low | **FIXED** |
| A6 | Test History title truncated on desktop | Medium (main workflow, legibility) | **OPEN** |
| A7 | Help-bot bubble covers actions on phones | Medium | **OPEN** (needs bottom padding on the scroll container) |
| A8 | Sub-routes beyond the tabs (Test Generator, Analytics page, Contests, Settings) not redesigned | — | **OPEN** (out of this round) |
| A9 | Other hard-coded figures in Analytics (e.g. "Benchmark Preview Mode" copy) not reviewed | Medium | **OPEN** — needs review against real data |
| A10 | `?tab=` deep links only for assignments/modules | Low | OPEN |
| A11 | Security: `ncert_questions` / `ncert_chunks` public writes | High | **OPEN** — migration `27_public_write_lockdown.sql` written, tested locally, **not run on live** |
| A12 | Security: users can change own `profiles.coins` and insert `coin_transactions`; coins redeem for vouchers | High | **OPEN** — needs server-side ledger |

## 5. Performance baseline

| Metric | Value | Status |
|---|---|---|
| Dashboard first-load JS (gzip) | 267 KB before the earlier round → 210 KB now (22 files) | MEASURED (local prod build) |
| Dashboard first-load CSS (gzip) | 41 KB (one shared CSS file for the whole app) | MEASURED |
| Teacher dashboard chunk (gzip) | 83 KB → 22 KB (tabs lazy) | MEASURED (earlier round) |
| LCP / CLS / TBT, Lighthouse | — | **NOT MEASURED** (Lighthouse not installed; no authenticated lab run) |
| INP / LCP field data | — | **NOT MEASURED** (no RUM data; Vercel Speed Insights is installed) |
| Runtime paint cost of blur/backdrop-filter | — | **NOT MEASURED** |
