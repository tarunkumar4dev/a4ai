# PR #21 — a4ai Agent UI v2 → v3

## Summary

- **v2** (commits 0b2e62c–4b79916): ChatGPT-style server history, Google-style suggestions combobox, message actions (stop/regen/edit/feedback), ScopeCard + SectionComparison, a11y audit, shortcuts, e2e on mock adapter.
- **v3** (commits 281b3d5–de042be): contract-first rewrite against RAG-BACKEND `agent_openapi_v2.json` (contract 1.2 → 1.3).

### v3 phases

| # | Commit | What |
|---|--------|------|
| 0+1 | 281b3d5 | **Contract codegen** (`openapi-typescript` 7.4.4 → `api.gen.ts`) + **Privacy** (zero chat content in storage; only id prefs) |
| 2 | 7317e4e | **Docs** — `AGENT_UI.md` v3 section with 17-row mismatch table vs v2 |
| 3 | 8f007d2 | **Roles** — admin/HOD can open `/dashboard?tab=agent` (skip redirect) |
| 4 | 85adb27 | **Speed** — prefetch suggestions on focus; bundle sizes measured |
| 5 | 872b747 | **Contrast** — `--muted-foreground` 46.9% → 46% = 4.65:1 (WCAG AA) |
| 5+6 | dcf1929 | **Tests** — axe-core a11y, e2e updated for in-memory mock |
| 7 | de042be | **Contract 1.3** — regen api.gen.ts, wire scope/approval/file, fix 3 pre-existing e2e |

### Key v2 → v3 changes

- **Sessions**: `{sessions:[{session_id}]}` → `{items:[{id, last_message_at, preview}]}`
- **Messages**: `{messages:[…]}` → `{items:[…]}` ascending, limit ≤200
- **Queries / Suggestions**: wrapped objects → bare arrays
- **my_scope / section_comparison**: dedicated events → `table` with source routing
- **Chat caching removed**: no localStorage/sessionStorage/IndexedDB of message text (privacy)
- **Mock**: in-memory only, deterministic seed, backend `auto_title` algorithm
- **Feedback**: `up|down` only (no null/clear), not returned in messages
- **Cancel**: `X-Agent-Request-Id` header, `final.cancelled: true`
- **Exhaustive type checks**: `never` in `eventToBlock` + `EVENT_TYPES`

### Bundle sizes (production build)

| Chunk | Size | Gzip |
|-------|------|------|
| AgentChatPanel | 255.75 KB | 76.44 KB |
| AgentWorkspace | 5.21 KB | 2.42 KB |
| AgentHistoryPanel | 13.00 KB | 4.99 KB |
| AgentChart | 9.69 KB | 3.93 KB |
| store | 39.82 KB | 13.05 KB |
| main (agent NOT included) | 411.86 KB | 122.95 KB |
| KaTeX (separate chunk) | 260.30 KB | 77.39 KB |
| Recharts (separate chunk) | 374.77 KB | 103.33 KB |

### Tests

- **374 vitest** unit tests: contract (14), privacy (3), blocks/roles/events/store/mock + all other project tests
- **13 Playwright e2e** (mock adapter, 9 run + 4 screenshot-only): history, rename/pin/delete, suggestions, stop/regen/edit, scope/ranking, mobile sheet, contrast audit, axe-core a11y (both themes)
- Contract test reads the OpenAPI JSON snapshot at runtime → a new backend event type fails at compile time (fixtures.ts) AND at runtime (contract.test.ts)

### Blocked on the backend

1. **Feedback not replayed** — `MessageItem` in contract 1.3 has no feedback field → 👍/👎 reset on reload
2. **Real-backend e2e** — needs scripted LLM provider (no API keys set → 503)

### Resolved in contract 1.3

- **File event / download** — wired (FileReady with kind, download_path)
- **Approval persistence** — eventToBlock reads status/result_ref/decided_at from stored events
- **Meta scope** — empty state uses batch_count + student_count + batches from /agent/meta

### Files outside agent folders

| File | Change |
|------|--------|
| `src/index.css` | `--muted-foreground` lightness 46.9% → 46% (contrast fix) |
| `src/pages/TeacherDashboardPage.tsx` | Skip redirect when `tab=agent` (admin/HOD access) |
| `package.json` | +devDeps `openapi-typescript`, `@axe-core/playwright`; script `agent:contract` |
| `scripts/agent-contract.mjs` | OpenAPI → codegen pipeline |
| `playwright.agent-mock.config.ts` | Unchanged (still matches `agent-v2.spec.ts`) |
| `tests/e2e/agent-v2.spec.ts` | Updated for v3 mock + axe-core |

🤖 Generated with [Claude Code](https://claude.com/claude-code)


---

## Voice (contract 1.4, commits 53fabf8 → 0ecef14)

| phase | commit | what |
|---|---|---|
| 2 | 53fabf8 | push-to-talk core: pure state machine (idle → listening → transcribing → thinking → speaking), silence auto-stop, MIME pick (webm/opus Chrome, mp4 iOS), recorder with noiseSuppression / echoCancellation / autoGainControl |
| 3 | 992a113 | route registry copy (`src/lib/agent/routeRegistry.json`, `npm run agent:routes`), `resolveRoute` (role-gated, typed params), test that every key exists in `App.tsx` |
| 4 | 0ecef14 | mic in Ask a4ai + floating mic on mobile dashboards (56 px), transcript strip (auto-send pause + Edit, "Maine suna … Sahi hai?", chips, "Dobara boliye"), spoken replies with mute, voice + speed settings, first-use consent + 3 example chips, `ui_action` navigate / highlight Confirm, contract 1.4 regen |

- Lazy: `VoiceDock` chunk **8.0 KB gzip**, `FloatingMic` **0.6 KB gzip**. No new dependencies. The registry JSON and
  the tiny ui_action bus are in the main bundle (the launcher executes navigation).
- Slow network (`navigator.connection` / the app's network check): no level meter, browser speechSynthesis.
- Accessibility: aria-label on the mic (Hindi + English), one aria-live region for transcript + spoken caption,
  hold Space to talk on desktop, design tokens only, meter is transform-only, `motion-safe` on the Confirm pulse.

**Ran and passed:** `npx vitest run` 409/409 (38 files). `tsc` shows no new errors in agent/voice files; the 4
remaining are pre-existing (`AgentEventBlock.test.ts` meta casts, `FileCard.size_bytes`, `queries.ts:295`).
`vite build` succeeds.
**Not verified:** nothing was run in a real browser or on a phone. MediaRecorder, mic permission, autoplay and TTS
playback on Chrome Android / iOS Safari are untested. Playwright e2e was not run or extended for voice.

### UI polish pass

| phase | commit | what |
|---|---|---|
| 0 | 4b2c7f3 | screenshots at 3 viewports x 2 themes (60 PNGs) + `docs/UI_AUDIT.md` with 20 issues ranked P0-P3 |
| 1 | e43aceb | FIX: a4ai logo in empty state, all user text Hindi/Hinglish, dark mode contrast, safe-area, DataTable a11y, VoiceDock layout (centered 64px mic), full mock scenario, 18 files touched |
| 2 | 8dd9a18 | after screenshots (78 PNGs) + `docs/UI_BEFORE_AFTER.md`, screenshot spec now uses `AGENT_SHOTS_DIR` env var |

- **Bundle:** AgentChatPanel chunk **75.96 KB gzip**, VoiceDock chunk **7.9 KB gzip**. No new dependencies.
- **Tests:** vitest 409/409, tsc clean (pre-existing errors unchanged), vite build OK.
- Playwright e2e: 6/6 screenshot tests pass.

**Seen in a real browser:** Playwright Chromium screenshots at 360/768/1440 in light + dark (78 PNGs in `docs/ui/after/`).

**Written but not seen:** all Phase 1 changes were verified by tsc, vitest, and Playwright screenshots. Not tested on a real phone or with real backend data.

**Not done:**
- Chart x-axis label clipping at 360px (chart is lazy; no issues visible in screenshots but real data could overflow)
- Voice states not visually tested (mic does not appear in mock without voice config endpoint)
- Real phone one-handed reachability testing (Playwright can only simulate viewport size)
- Contrast audit with a tool like axe (only visual check via screenshots)
- The 5 phone tests from the spec (real Android device)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
