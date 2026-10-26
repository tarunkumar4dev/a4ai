# a4ai Website Redesign — Audit Notes

## Framework & Architecture
- **Framework**: React 18 (SPA) + Vite + TypeScript
- **Styling**: Tailwind CSS 3 + shadcn/ui (Radix) + CSS custom properties
- **Routing**: react-router-dom v6 (client-side)
- **State**: React Query, Context providers (Auth, Access, Coin, Theme)
- **Auth**: Supabase Auth (email, Google OAuth)
- **Payments**: Razorpay
- **Analytics**: Vercel Analytics + Google Analytics
- **Hosting**: Vercel (vercel.json)
- **Build**: Vite with multi-entry (index.html + s.html for upload links)

## Current Homepage Implementation
- **Route**: `/` → `LandingPage.tsx`
- **Components**: Navbar → LandingHero → LandingDemo (video) → AiToolsSuite → HowItWorks → UpgradedCTA → TrustSecurity → Outcomes → Testimonials → FinalCTA → Footer
- **Hero**: Centered text-only layout, no product preview
- **Font**: Plus Jakarta Sans (Google Fonts CDN — violates no-CDN rule) + Halenoir Expanded (local WOFF2)
- **Colors**: Coral `#f75961` as accent, black CTAs, peach `#fff0f1` badges

## Existing Brand Assets
- **Logo**: `/public/images/LOGO.png`
- **Icon**: `/public/ICON.ico`
- **Fonts**: `/public/fonts/Halenoir-Expanded-DemiBold.woff2`, `/public/fonts/Caveat-Bold.ttf`
- **Team photos**: aakash_a4ai.jpg, tarun_a4ai.jpeg, yash_a4ai.jpg
- **Demo**: demo.mp4, demo-poster.png, showcase-bg.png

## Existing Design Tokens
- CSS vars in `index.css` (HSL-based shadcn tokens)
- `tokens.css` has additional vars (--primary, --secondary, --accent, etc.)
- `globals.css` for dark mode
- Tailwind config has zolvio purple theme (legacy), flashcard colors
- Coral accent: `#f75961` / `#f75961` used throughout

## Existing Reusable UI Components (shadcn/ui)
- Full shadcn/ui library in `src/components/ui/` (Button, Card, Dialog, etc.)
- Navbar (shared across pages)
- Footer (shared across pages)
- LandingHero (text-only, centered)
- LandingDemo (video player)

## Current Public Navigation
- Home `/`
- AI Tools `/#ai-tools` (anchor scroll)
- Features `/features`
- Pricing `/pricing`
- Resources `/resources`
- About `/about`

## Existing Route Destinations (Public)
- `/features`, `/pricing`, `/about`, `/contact`, `/careers`, `/privacy`, `/terms`, `/cookies`
- `/resources`, `/docs`, `/help`, `/blog`, `/case-studies`
- `/demo`, `/faq`, `/rules`, `/api`
- `/login`, `/signup`, `/forgot`, `/reset-password`
- `/dashboard/test-generator` (public, no login needed)

## Existing Pricing Source
- `PricingPage.tsx` (~980 lines) contains hardcoded pricing plans
- Individual/Institute/College audience segments
- Monthly/Yearly billing periods

## Existing Testimonials (verified in code)
- Rahul Verma — Director, Education Beast
- Abhay Gupta — Director, Chanakya Institute
- Aman Singh — Chemistry Teacher (10+ Years Exp)

## Verified Product Capabilities (from code)
- Test Generator (NCERT 1 Lakh+ questions, CBSE pattern)
- AI Paper Checker (handwritten copies)
- Video to Live Quiz (YouTube → MCQs)
- Worksheet Studio
- Smart Flashcards
- PYQ Question Bank
- PDF & DOCX export
- Answer keys included
- Section-wise papers
- Bloom's Taxonomy spread
- Bilingual English/Hindi
- Attendance management
- Institute/HOD/Proctor/Teacher hierarchy
- Student portal
- Upload link (copy checking)

## Performance Issues Identified
- Razorpay checkout.js loaded synchronously in index.html (render-blocking on every page)
- Google Fonts CSS loaded via CDN (render-blocking)
- framer-motion in bundle (MotionConfig set to reducedMotion="always")
- lite.css already kills all animations/transitions
- Demo video autoplay on landing page

## Build & Test Commands
- `npm run dev` — Vite dev server on port 8080
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Vitest (40 unit tests)
- `npm run e2e` — Playwright (7 tests)

## Contact Information (verified)
- Email: a4ai.team@gmail.com
- YouTube: @a4ai_Official
- X/Twitter: @a4aiOfficial
- Instagram: a4ai.in
- LinkedIn: /company/a4ai-in
- Founder: Tarun Pathak

---

## Implementation Checklist

### Phase 1 — Design Foundation
- [ ] Add a4ai coral design tokens to Tailwind config
- [ ] Set up typography scale with clamp()
- [ ] Create layout container utilities
- [ ] Create button component variants (primary black, secondary coral outline)

### Phase 2 — Shared Public Shell
- [ ] Redesign Navbar (cleaner, coral active state, proper hierarchy)
- [ ] Redesign Footer (organized columns, no newsletter form without backend)
- [ ] Add skip link for accessibility

### Phase 3 — Hero
- [ ] Two-column layout (messaging left, product preview right)
- [ ] Eyebrow label
- [ ] Headline with coral accent
- [ ] Supporting copy
- [ ] CTAs (Try Free black, View Pricing coral outline)
- [ ] Capability chips
- [ ] Static product preview (CSS/HTML illustration)

### Phase 4 — Main Content
- [ ] Capability strip
- [ ] Problem/solution section
- [ ] Feature grid (tools showcase)
- [ ] How it works (3-step)

### Phase 5 — Optional Sections
- [ ] Testimonials (existing verified ones)
- [ ] FAQ (details/summary pattern)
- [ ] Final CTA
- [ ] Pricing preview (link to /pricing)

### Phase 6 — Responsive & Accessibility
- [ ] Test all viewport sizes
- [ ] Keyboard navigation
- [ ] Focus states
- [ ] Contrast checks

### Phase 7 — Verification
- [ ] Build succeeds
- [ ] Lint passes
- [ ] Tests pass
- [ ] No console errors

