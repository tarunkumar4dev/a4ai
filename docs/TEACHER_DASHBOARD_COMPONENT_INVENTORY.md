# Teacher dashboard — component inventory (28 Oct 2026)

What exists today, where it is used, and what new dashboard work should reuse. Counts are `grep -rl` over `src/`
on branch `perf/teacher-dashboard` (files, not call sites). Rule for new work: reuse an existing implementation; do not
add a third one where two already compete.

| Concern | Existing implementations (file) | Used in | Decision for dashboard work | Regression risk if changed |
|---|---|---|---|---|
| **Button** | shadcn `src/components/ui/button.tsx` (26 files, incl. Login, Signup, NotFound, Contest pages); hand-written Tailwind classes in most dashboard tabs; `BLACK_BTN` in `src/lib/uploadLink/styles.ts` (8 files, upload-link flow); `GlossyButton` / `SidebarButton` in `TeacherDashboardPage.tsx` | everywhere | Dashboard tabs keep local class constants (`BTN_PRIMARY` = `#111111`, 44 px, radius 12; `BTN_SECONDARY` = white + gray border), as in `TeacherAttendanceView.tsx`. Do not restyle `ui/button` (Login/Signup use it) | High for `ui/button` (marketing + auth) |
| **Card** | `ui/card.tsx` (6 files: Analytics, Contest pages, StudentsPage); hand-written `rounded-2xl border bg-white` everywhere else; `.glass` CSS in some tabs | dashboard tabs | White surface + `border-gray-200`, no blur, no gradient. Pastel only for meaning | Low |
| **Input / Select** | `ui/input.tsx` (9 files); `ui/select.tsx` (Radix, 2 files); native `<select>` in generator, attendance, assignments | forms | Native `<select>` with a visible `<label>` (works with phone pickers and is lighter); min height 44 px | Low |
| **Dialog** | `ui/alert-dialog.tsx` (Radix; Attendance, `checker/useConfirm.tsx`, CopySubmissionsTab, ContestLivePage); `ui/dialog.tsx` (CheckingLink, AnalyticsPage); about 45 files with a hand-rolled `fixed inset-0` overlay | confirms, modals | New confirms: `ui/alert-dialog` (focus trap, Esc, `role="alertdialog"`). Leave hand-rolled modals until their route's stage | Medium (Esc handling: see Stage 4 note) |
| **Tabs** | `ui/tabs.tsx` (Analytics, ContestLanding); hand-written tab bars (Test Generator page, dashboard sidebar) | — | Keep each route's own bar; no new tab primitive | Low |
| **Table / list** | `ui/table.tsx` (AnalyticsPage only); `<table>` in 4 files; `<ul>` + `divide-y` lists | lists | Phones: rows/lists, not wide tables | Low |
| **Toast** | `sonner` (33 files; mounted once in `App.tsx`, top-right, rich colors); Radix `use-toast` (7 files: Login, Signup, AuthCallback, RoleSelection, PYQ…); Attendance had its own toast stack (removed in Stage 4) | — | Dashboard: `sonner` only. Persistent problems (failed save) go inline, not only in a toast | Medium for `use-toast` pages (auth) — don't touch |
| **Badge** | `ui/badge.tsx` (6 files); hand-written pills | status | Hand-written pill: text + colour (never colour only) | Low |
| **Empty state** | none shared | — | Inline per route: what is missing + why (if known) + one valid action | — |
| **Error state** | none shared; many tabs only `console.error` | — | `role="alert"` card with the message and "Try again" | — |
| **Loading** | `ui/skeleton.tsx` (only inside `ui/sidebar.tsx`); `animate-spin` in 44 files | — | Short text ("Loading classes…", `aria-busy`), spinner only inside a busy button | Low |
| **Navigation** | `SidebarButton` + drawer in `TeacherDashboardPage.tsx`; marketing `src/components/site/PageShell.tsx` (Navbar + Footer) | — | Dashboard keeps its sidebar; never import `PageShell` into the dashboard | High for PageShell (marketing) |
| **Icons** | `lucide-react` (96 files); inline SVG `Icon(s)` objects in 10 files (attendance, analytics, settings, dashboard…) | — | Use what the file already uses; `aria-hidden` on decorative icons, `aria-label` on icon-only buttons | Low |
| **Typography** | Plus Jakarta Sans self-hosted (`public/fonts`, `@font-face` in `index.css`); `font-halenoir` maps to Jakarta (Halenoir file is 0 bytes) | all | Body 400–500, labels 600, headings 700; text `#1B1B1B` | High (`index.css` is shared with marketing) |
| **Help bubble** | `src/components/chat/StaticSarthi.tsx` (fixed, bottom-right; teacher + student dashboards) | dashboards | Wrapper class `a4-help`; hidden on the attendance sheet via `index.css` `body:has(.att-sheet) .a4-help`. Use the same hook for any screen where it covers row actions | Low |

Shared-file rule: `index.css`, `tailwind.config.ts`, `ui/*`, `PageShell`, `Navbar`, `Footer` are also used by marketing
pages. Add scoped classes; don't change defaults.
