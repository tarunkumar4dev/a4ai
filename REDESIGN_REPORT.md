# Marketing redesign report (26 Oct 2026)

Branch `feat/landing-showcase`. Audit and baseline: `NOTES.md`.

## 1. Pages
- **Landing** (`/`) — hero product showcase (autoplay 2 s, swipe, pause), partners wall instead of the pricing preview.
  Details in `CLAUDE.md` progress log.
- **About** (`/about`) — rewritten on the shared shell: hero "Building Better Tools for Education", two mission cards,
  team, partners (same component as the landing page), CTA. Removed: unverified stats, invented testimonials,
  fake partner tiles, milestone timeline, values grid with unverifiable claims, framer-motion, Google Fonts import.
- **Features** (`/features`) — seven pastel rows (test papers, copy checking, assignments, attendance + calendar,
  analytics, contests, institutes). Only capabilities found in the code (`NOTES.md`), every link is an existing route.
  Rows reuse the landing screenshots (lazy) and the coded Test Generator preview.
- **Resources** (`/resources`, `/blog`, `/case-studies`) — shared shell, breadcrumb, section tabs, search with an empty
  state, cards for Docs / Help Center / FAQ / Blog. "a4ai Hub" → "Resources" (display only; route unchanged).
  Case Studies shows an honest empty state; Blog cards no longer have buttons that go nowhere.
- **Login** (`/login`) and **Signup** (`/signup`) — white page, shared Navbar, plain card, `<label for>` on inputs, inline `aria-live` error.

## 2. Design system
`src/components/site/PageShell.tsx`: landing Navbar + Footer, `Container` (1200 px), `SectionHeading`,
`BTN_PRIMARY` (black) / `BTN_SECONDARY` (coral outline), per-page title, description, canonical, OG, JSON-LD.
Fonts and colours as in `NOTES.md`. Navbar: no item highlighted on pages outside the nav, Resources highlighted on its sub-pages.

## 3. Team
| Person | Role | Photo |
|---|---|---|
| Tarun Kumar Pathak | Co-founder & Product | `tarun_a4ai.jpeg` → 4 KB / 12 KB WebP |
| Yash Dubey | Co-founder & Backend | `yash_a4ai.jpg` → 5 KB / 12 KB WebP |
| Aakash Singh | Co-founder & Marketing | `aakash_a4ai.jpg` → 5 KB / 11 KB WebP |
| Nitin Kumar | Founding Engineer | **missing** → initials "NK" |
| Durgesh | Dev | **missing** → initials "D" |
| Aman Singh | Mentor (separate card) | **missing** → initials "AS" |

Add a photo: `design/source-images/nitin*.jpg` (or `durgesh*`, `aman*`) → `python scripts/build-team-photos.py`.

## 4. Login / signup characters (`src/components/auth/AuthCharacters.tsx`)
- `pointermove` no longer touches React state; one `requestAnimationFrame` per move (no loop) writes SVG transforms.
- Off for touch-only devices (`hover: none`), reduced motion, Data Saver, hidden tab; listener removed on unmount.
- Wrong password: Supabase `error.code === "invalid_credentials"` (message regex only when no code) → the faces
  shake "no" (one class on the `<svg>`, 2 × 160 ms, transform only, `.a4-no` in `src/index.css`; skipped under
  reduced motion) and the inline message reads "Wrong email or password. Try again." Rate limit, server and network
  errors show their message without the shake. Existing lockout, CAPTCHA, WAF, toasts and redirects unchanged.

## 5. Performance (Playwright, 390×844 @2x, 1.6 Mbps / 150 ms / 4× CPU, best of 2)
| Page | LCP before → after | CLS before → after | Transfer before → after |
|---|---|---|---|
| /about | 6.7 s → 3.8 s | 0.001 → 0 | 1113 → 540 KB |
| /features | 7.0 s → 4.4 s | 0.013 → 0 | 599 → 568 KB |
| /resources | 3.7 s → 3.3 s | 0.001 → 0 | 563 → 528 KB |
| /login | 4.0 s → 4.2 s | 0.017 → 0 | 516 → 522 KB |

"Before" = live a4ai.in (Vercel CDN), "after" = local `vite preview`, so servers differ. Part of the gain is the earlier
commit on this branch (Razorpay script no longer on every page). Route chunks (gzip): About 2.7 KB, Features 4.0 KB,
Login 7.1 KB, Blog 0.9 KB, Case Studies 0.7 KB.

**Not met:** LCP < 1.8 s, 0 KB JS, content without JS. The app is a client-rendered SPA; every route waits for the
shared main bundle. Meeting those needs prerendered HTML for the marketing routes (a build step + hosting change),
which was not done. Lighthouse itself was not run (not installed).

## 6. Validation
- `npm run build` ✓ · `npm test` 134/134 ✓ · ESLint on changed files 0 errors ✓
- `tsc`: no errors in changed files (pre-existing errors elsewhere unchanged)
- 320 / 390 / 768 / 1024 / 1440 px: no horizontal overflow, one `<h1>`, no "Hub" text on About, Features, Resources,
  Blog, Case Studies, Login ✓
- Login with mocked Supabase responses: `invalid_credentials` → shake + message ✓; 429 → message, no shake ✓;
  500 → message, no shake ✓
- Feature screenshots load on scroll ✓
- Not tested: 200 % zoom / OS text size, JS-disabled rendering (blank — SPA), real Google login.

## 7. Third-party requests
Pages fetch only same-origin files plus Supabase (auth/session) and, after `load`, Google Analytics (~177 KB) and
Vercel Analytics / Speed Insights.

## 8. Remaining
- Photos for Nitin Kumar, Durgesh, Aman Singh.
- Help Center and Docs content is developer-oriented (Supabase tables, Edge Functions) — needs teacher-facing copy.
- Blog posts have no article pages.
- Prerendering for the marketing routes (see §5).
- `react-helmet` logs an UNSAFE_componentWillMount warning in development (library, pre-existing).
