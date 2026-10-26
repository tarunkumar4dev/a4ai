# Landing page screenshots (hero showcase)

The hero on `/` has a switchable product showcase
(`src/components/landing/FeatureShowcase.tsx`). Slide text lives in
`src/components/landing/featureSlides.ts`; screenshots are picked up
automatically — you never edit the component to change an image.

## Add or replace a screenshot

1. Save the original screenshot in `design/source-images/` (PNG or JPEG, any name
   that starts with the prefix below; case doesn't matter).
2. Run `python scripts/build-feature-images.py` (needs `pip install pillow`).
3. It writes `src/assets/features/<slide-id>-<width>.webp` (1280 px and 720 px wide,
   or less if the source is smaller). Commit those files.

A slide only appears once its WebP exists, so contests / leaderboard stay hidden
until you add their screenshots.

| Slide id | Source file prefix | Notes |
|---|---|---|
| `test-generator` | — | coded preview (`TestGeneratorPreview.tsx`), no image |
| `institute-management` | `institute_manage…` | join code is blurred |
| `attendance` | `attendance1…`, `attendance…` | |
| `analytics` | `analytics…` | labelled "Sample data" (benchmark preview data) |
| `paper-checker` | `test_checker…`, `paper_checker…` | right half (red-pen copy) |
| `assignments` | `assignment…` | student names + upload-link token are blurred |
| `calendar` | `calendar…` | |
| `live-contests` | `live_contest…`, `contest…` | hidden until added |
| `leaderboard` | `leaderboard…` | hidden until added |

## Taking a good screenshot

- Browser zoom 100 %, window ~1400–1600 px wide, light mode.
- Capture at device pixel ratio 2 if you can (Windows display scale 200 %, or Chrome
  DevTools → device toolbar → DPR 2). Text then stays sharp after resizing.
- Use demo data. **No real student names, phone numbers, roll/enrolment numbers,
  join codes or live link tokens** — the landing page is public. If a real value
  is unavoidable, add a blur box for it in `JOBS` in the script.
- The frame is 16:10. The script crops to the `crop` box in `JOBS` and pads the
  rest with the screenshot's own page colour; adjust `crop` for a new screenshot.

## Output settings

WebP quality 86, method 6, Lanczos resize, light unsharp mask (radius 1.2, 70 %).
Typical size 15–100 KB per file. The first slide is coded, so the first paint loads no
screenshot. The showcase advances every 2 s; only the current slide and a preload of
the next one are fetched, and autoplay stops off screen, on hover/keyboard focus,
after the pause button, and for reduced-motion / Data Saver users.

## Partner logos

Originals in `design/source-images/` → `python scripts/build-partner-logos.py` →
`src/assets/partners/<slug>.webp` (trimmed, on white, longest side 320 px). The list is
in `src/components/landing/Partners.tsx`; a partner without a logo file is not shown.
