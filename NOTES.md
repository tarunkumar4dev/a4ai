# Marketing pages audit (26 Oct 2026)

Audit done before the About / Features / Resources / Login redesign. Report: `REDESIGN_REPORT.md`.

## Stack
- React 18 SPA, Vite 5, TypeScript, Tailwind 3 + shadcn/ui, react-router 6, Supabase auth. Hosted on Vercel.
- Every page is client-rendered: nothing shows until the main bundle runs. There is no prerender/SSR step.
- Typography = landing page: Plus Jakarta Sans, self-hosted variable WOFF2 (`public/fonts/PlusJakartaSans-latin*.woff2`,
  weights 400–800 in one file, latin preloaded). `font-halenoir` maps to it (`Halenoir-Expanded-DemiBold.woff2` is 0 bytes).
- Tokens: coral `#F95D6A` / deep coral `#D93F4D`, ink `#1B1B1B`, muted `#5D6570`, alt `#F7F8FA`, line `#E5E7EB`,
  pastel gradient themes in `src/components/landing/featureSlides.ts` (`THEMES`).
- `src/styles/lite.css` turns every CSS animation/transition off (Play Store WebView).

## Pages before the change
| Page | File | Found |
|---|---|---|
| About | `src/pages/AboutPage.tsx` (987 lines) | Own glass navbar; Google Fonts `@import`; framer-motion reveals + mouse-follow glow (rAF); unverified stats (3.5K+ papers, 25+ schools, 99.9 % uptime); invented testimonials (Ritika Sharma, Arvind Rao); partners list with "CBSE"/"SkillED" text tiles; claims like "end-to-end encrypted storage", "SSO". Team: Tarun Pathak, Yash Dubey, Aakash Singh (all "Co-Founder"). |
| Features | `src/pages/FeaturesPage.tsx` (633 lines) | Google Fonts `@import`, animated gradient, count-up, framer-motion. Lists features not in the code: face match, gaze detection, syllabus import, A/B sets, co-editing/approval flow, discrimination index. |
| Resources | `src/pages/Resources/*` | Header label "a4ai **Hub**" (`ResourcesLayout.tsx:130`), also `ApiPage.tsx:336`. Injected `!important` global styles, mouse glow. Case Studies page = two unverifiable schools/results with a button that goes nowhere; Blog "Read article" buttons go nowhere. Help Center content is developer-internal (profiles table, Edge Functions). |
| Login | `src/pages/LoginPage.tsx` (746 lines) | Blue-grey glass background + dark toggle. Eye characters: inline SVG (~2 KB), but `pointermove` → `setPointer` re-rendered the whole page on every mouse move and called `getBoundingClientRect` 30+ times per render. No inline error region; errors only in toasts; inputs had no `<label for>`. |

## "Hub" occurrences
- `ResourcesLayout.tsx` header wordmark — UI copy → changed to Resources.
- `ApiPage.tsx` link label "Hub" → Resources (route `/resources` unchanged, so no redirect needed).
- No route, table, API or identifier uses "Hub".

## Assets
- Team photos in `public/images`: `tarun_a4ai.jpeg` (1280², 82 KB), `yash_a4ai.jpg`, `aakash_a4ai.jpg`.
- **Missing:** Nitin Kumar, Durgesh, Aman Singh — no photo anywhere in the repo or `design/source-images`.
- Product screenshots: `src/assets/features/*.webp` (from the landing work, 13–103 KB).
- Partner logos: `src/assets/partners/*.webp` (2–19 KB).

## Verified capabilities (for Features)
Test generator (NCERT chapter library, MCQ/short/long, answer keys, logo + watermark, PDF/DOCX) · Check Copies (photos,
rubric from key, per-question marks, teacher approve/publish) · assignment upload links (deadline, attempts, late
policy, open link) · attendance (teacher marking, admin/HOD tracker, monthly report, day sheet) · calendar · marks &
attendance analytics · contests (camera `getUserMedia`, `visibilitychange` tab-switch, podium leaderboard, CSV) ·
video-to-quiz (`/teacher/community-quiz/new`) · institute roles, Excel bulk upload, student portal with access codes.

## Baseline (live a4ai.in, before)
Playwright, 390×844 @2x, 1.6 Mbps / 150 ms RTT / 4× CPU, best of 2:
| Page | LCP | CLS | Transfer |
|---|---|---|---|
| /about | 6.7 s | 0.001 | 1113 KB |
| /features | 7.0 s | 0.013 | 599 KB |
| /resources | 3.7 s | 0.001 | 563 KB |
| /login | 4.0 s | 0.017 | 516 KB |
