# a4ai Agent: UI redesign, three languages and voice input. Walkthrough

Branches, local only and **not pushed**:
- Frontend `feat/agent-ui-i18n`, worktree `C:\Users\login\Downloads\worktrees\fe-agent-ui-i18n`.
- Backend `feat/agent-ui-i18n`, worktree `C:\Users\login\Downloads\worktrees\be-agent-ui-i18n`.

Both branches stack on `claude/youthful-archimedes-tw0p0s`, the open PR branch, because the agent panel exists only there. The plan and audit are in [PLAN.md](PLAN.md).

## Deploy order: backend first, then frontend

1. **Backend** (`RAG-BACKEND`, Render service `a4ai-agent`): commit `54ea6eb`. It adds an optional `language: "en" | "hi" | "hinglish"` field to `ChatRequest`, with `"hinglish"` as the default.
   - Older request bodies still validate.
   - `extra="forbid"` still rejects any other unknown field.
   - `VoiceChatRequest` inherits the field.
2. **Frontend** (Vercel): it sends `language` only when it isn't `hinglish`. So Hinglish users keep working even against an older backend, but English and Hindi requests need the new backend, or they get a 422.

The backend patch is three files (`agent/schemas.py`, `agent/core.py`, `agent/api.py`) plus `tests/agent/test_language_param.py`.
- `core.system_prompt(ctx, voice, language)` appends one line, `LANGUAGE_LINES[language]` + `LANGUAGE_TAIL`, at the **end** of the system prompt. The cached prefix (tools plus the rest of the system text) therefore stays the same for all three languages.
- If the user clearly writes in another language, the reply follows them.
- Names from the DB are never translated.
- The language of test-paper questions doesn't change.

## Commits

| Gate | Frontend | Backend |
|---|---|---|
| G0 audit + plan | `3afaf05` | — |
| G1 i18n layer, language menu, `language` field, preview harness | `56bc2b0` | `54ea6eb` |
| G2 header, one suggestion surface, capability-aware starters, composer | `dba162e` | — |
| G3 voice input (never auto-sends) | `a33a2b4` | — |
| G4 connection state machine, streaming UX, friendly errors | `05fcd45` | — |
| G5 conversation, history, card chrome | `25ad580` | — |
| G6 Devanagari typography, a11y, phone behaviour | `166a41b` | — |
| G7 bundle (dictionaries kept out of the entry bundle) | G7 commit | — |
| G8 verification, screenshots, walkthrough | G8 commit | — |

## What changed, by defect

1. **Permanent "Connecting…".**
   - *Root cause:* the header pill rendered "Connecting…" for both `loading` and `error`. `GET /agent/meta` ran once, with no timeout and no retry. A prod build without `VITE_AGENT_URL`, a cold Render start, and a socket that never answers all looked the same, forever.
   - *Now* (`lib/agent/connection.ts` plus the store): each attempt times out after 25 s, the state turns "slow" after 8 s and shows Retry, retries back off at 2/4/8 s ("reconnecting"), and then it shows "failed" with Retry. 401 and 403 stop at once, and coming back online retries.
   - When ready, nothing is shown. While connecting, the scope chip is a skeleton.
2. **Duplicate prompts.** The empty box has one suggestion surface: the starter cards. The typeahead opens only after 2+ characters (max 4 items, sentence-case heading), and the cards step aside while it's open.
3. **No-batch dead end.**
   - The scope chip becomes "Teacher · Abhi koi batch assign nahi hai" in amber, with an info popover (`scope.noneHelp`).
   - Attendance and marks cards stay visible but disabled, with the reason. They remain focusable, so the reason is read out.
   - The test card comes first.
   - Features the backend turns off (`meta.features`) aren't offered.
3. **Header.** One avatar and a 56 px row: language, history, new chat and close, plus ⋯ (widen panel to 720 px, keyboard shortcuts, clear search history).
   - Every icon has a tooltip and an `aria-label`.
   - The role badge is gone; the role now appears in the scope chip.
   - A "Demo data" chip appears only on demo data.
5. **Small text.**
   - Nothing in the panel is below 12 px, and there are no ALL-CAPS labels.
   - The keyboard hint appears only on desktop focus (`pointer: fine`).
   - The trust line has an info popover.
6. **i18n.** `src/lib/agent/i18n`: typed dictionaries for Hinglish (the source of truth), English and Hindi.
   - A missing key fails `tsc`.
   - Interpolation uses `{name}`, plurals use `Intl.PluralRules`, and numbers use en-IN grouping.
   - The `lang` attribute is set on the panel (`en`, `hi`, or `hi-Latn` for Hinglish) and on each sent message.
   - The choice is saved in `localStorage` under `a4ai.agent.lang`.
   - Switching languages re-renders text only: no remount, and the draft and scroll position are kept. Earlier messages are not re-translated.
7. **Voice.**
   - Engine: the existing server STT (Sarvam) when `/agent/voice/config` says it's enabled. Otherwise the free Web Speech API, with `en-IN` or `hi-IN` as a hint. With neither available, the mic is hidden.
   - The transcript always goes into the box for review. The old 5 s auto-send is gone, and only Send sends.
   - States: requesting, listening (with live text), processing, ready, denied, unsupported, network, timeout, and nothing heard.
   - Timing: recording stops after 2.5 s of quiet following speech, and caps at 60 s (Sarvam keeps its 30 s backend limit).
   - Permission is requested only on tap. The mic is released on stop and when the panel closes.
8. **Other fixes.**
   - `aria-busy` is set while streaming.
   - Auto-scroll pauses when you scroll up, and a "Jump to latest" pill appears.
   - Error cards never show an HTTP status or backend exception text.
   - Esc closes only an empty composer.
   - On phones the sheet follows the keyboard (`visualViewport`), and Back closes it.
   - The live region announces the finished answer once, not every token.

## Verification

Run on Windows, against the worktree's dev server (`npx vite --port 5281`) and the `/__agent-preview` harness:
- The harness is dev-only (`import.meta.env.DEV`) and renders the real panel against `lib/agent/mock.ts` plus fixtures.
- It fakes the user, network and scope. No credentials are involved.

| Check | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 40 errors, the same count as before, none in agent or voice code (all pre-existing: framer-motion types, flashcards, and so on) |
| ESLint on agent, voice and preview code | 0 errors (38 warnings, mostly existing fast-refresh notices) |
| `vitest run` (whole app) | **459 passed** (44 files). It was 436 before; the extra 23 are new tests: i18n parity, connection machine, dictation, capability rules, launcher/store text parity |
| Backend `tests/agent` | 424 passed, 14 skipped. One timing test (`test_local_stage_latency_is_small`) failed under build load and passes when run alone |
| Production build | succeeds |
| `/__agent-preview` in prod | absent: grep for `__agent-preview`, `PREVIEW_STATES` and `AgentPreview` in `dist/assets` and `dist/index.html` matches 0 files |
| axe (`scripts/agent-preview-axe.mjs`, 9 states: empty, no-batch 360, attendance, 429, failed, marks, voice listening/ready) | **0 serious or critical**. One contrast issue (the red "listening" label, 3.76:1) was found and fixed |
| Devanagari font lazy | Hinglish and English pages request 0 font files; हिन्दी requests `NotoSansDevanagari-var.woff2` once (checked via Playwright network log) |

### Bundle sizes (prod `vite build`)

| Chunk | before raw / gzip | after raw / gzip |
|---|---|---|
| **Entry `main-*.js`** | 492,058 / 147,399 | **490,971 / 147,493** (+94 B gzip: unchanged) |
| `chunkReload-*.js` (entry) | 149,694 / 48,528 | 149,694 / 48,528 |
| Global CSS `chunkReload-*.css` | 299,901 / 44,353 | 303,149 / 45,002 (+649 B gzip: the two `@font-face` rules and new Tailwind classes) |
| `AgentChatPanel-*.js` (lazy) | 254,085 / 75,605 | 266,009 / 78,710 (+3.1 kB gzip, including all three dictionaries) |
| `VoiceComposer-*.js` (lazy, new) | — | 12,959 / 4,269 |
| `VoiceDock-*.js` (lazy) | 28,527 / 9,212 | 7,475 / 2,275 (the panel no longer mounts the dock) |
| Devanagari font (on demand) | — | 120,056 B woff2, variable 400–600 |
| Dictionaries (minified / gzip) | — | hinglish 12.1 kB / 3.7 kB · en 11.4 kB / 3.6 kB · hi 33.9 kB / 4.9 kB, all inside the lazy panel chunk |

The trap fixed in G7: `store.ts`, `chatState.ts` and `roles.ts` are in the entry bundle, through the eager launcher's `useVoiceNavigation`. They now import only `lib/agent/i18n/lang` (no strings), `lib/agent/stepLabel.ts`, or the lazy `components/agent/starters.ts`. Importing `@/lib/agent/i18n` from eager code adds about 12 kB gzip to `main.js`. Two tests keep the launcher's and the store's inline text in step with the dictionaries.

### Screenshots (`shots/`, captured with `scripts/agent-preview-shots.mjs`)

| # | File | What |
|---|---|---|
| 1–3 | `01-empty-en-desktop`, `02-empty-hi-desktop`, `03-empty-hinglish-desktop` | empty state × 3 languages, 1280×720 |
| 4–6 | `04-empty-en-360`, `05-empty-hi-360`, `06-empty-hinglish-360` | empty state × 3 languages, 360×640 |
| 7 | `07-hi-nobatch` | Hindi, no batch: amber chip, info popover, disabled cards with the reason |
| 8 | `08-hi-streaming` | Hindi, streaming with a real step row and Stop |
| 9 | `09-hi-result-attendance` | Hindi, result (clarify chips after attendance lookup) |
| 10 | `10-hi-error-429` | Hindi, 429 with countdown on Retry |
| 11 | `11-hi-offline` | Hindi, offline strip |
| 12 | `12-hi-expanded-test` | Hindi, 720 px panel, test-paper preview + verification |
| 13 | `13-hi-voice-listening` | Hindi, voice listening with live transcript |
| 14 | `14-hi-voice-transcript` | Hindi, transcript in the box, "check, then press Send" |
| 15 | `15-hinglish-admin` | Hinglish, admin starters |
| 16 | `16-en-marks-tablet` | English, marks cards + table, 768 px |
| 17 | `17-en-failed` | English, connection failed + Retry |
| 18 | `18-hinglish-slow` | Hinglish, slow (> 8 s) + Retry |
| 19 | `19-en-session-expired` | English, 401: session expired card, 390×844 |
| 20 | `20-en-nobatch-360` | English, no batch at 360×640 with the help popover |

### Scenario matrix (section 6): what was run and what wasn't

| Scenario | Status |
|---|---|
| 1–6 (empty in 3 languages, no batch, teacher, admin) | ✅ screenshots |
| 7 attendance, 8 marks, 9 test paper | ✅ screenshots (mock and contract fixtures) |
| 10 long streaming, 11 Stop mid-stream | ✅ streaming screenshot; Stop is the existing tested path (Stop button visible in shot 08) |
| 12 slow, 13 offline, 14 401, 15 429, 16 5xx | ✅ screenshots (5xx captured during G4, `e5xx` state) |
| 17–19 voice in English / Hindi / Hinglish, 20 pause, 21 auto-stop 2.5 s, 22 manual stop | ⚠️ **logic only**: dictation reducer and timing constants unit-tested, UI states shown through the preview override. **Not run with a real microphone.** Headless Chromium has no working speech service. Must be checked on a real Android phone in Chrome |
| 23 permission denied, 24 unsupported (no mic) | ✅ preview states + reducer tests |
| 25 mobile keyboard open | ⚠️ `visualViewport` code in place; not verified on a device |
| 26 language switch mid-conversation | ✅ external-store design (no remount); draft kept in `agentStore.composerText`; not measured for CLS |
| Viewports 360 / 390 / 768 / 1280 / 1440 | ✅ |
| Throttled 3G, interrupted stream | ⚠️ not run; connection machine unit-tested with fake timers |
| Dark mode | ⚠️ not captured: the app's dark mode is class-based (next-themes), and the harness has no toggle yet. Components use tokens plus `dark:` variants as before |

## Deviations from the brief, and why

- **i18n location:** `src/lib/agent/i18n/`, not `src/features/agent/i18n/`, because the repo has no `src/features` and agent code lives under `lib/agent`.
- **Copy:** Hinglish copy was taken from the current UI. Status verbs moved from "raha hoon" to the gender-neutral "rahe hain", following the brief's "hum" rule. Where the brief's table gave text (`working`, `voice.listening`), the table won.
- **Sarvam cap:** the server voice keeps its 30 s cap, because the backend rejects longer audio. Web Speech uses 60 s.
- **History drawer, rename and undo** already existed; only their copy and labels changed.
- **Marks mini-bars** were not added. The existing stat cards and sortable table are kept, to avoid new chart code.
- **No 20-message cap exists** in the agent backend, so `error.msgcap` copy exists but nothing triggers it. Rate limits are per user and per institute (`agent/rate_limit.py`), not per IP.

## Deferred

- Inner labels of the result cards are still in their original language: "Copy CSV", "Source …", the paper, approval and blueprint card texts, and the voice consent and settings panels.
- Web Speech in Chrome sends audio to Google's speech service. There's no consent screen for that path yet. The server-voice path keeps its consent.
- A dark-mode toggle in the harness, a real-device voice and keyboard pass, and a throttled-3G run.
- `VoiceDock.tsx` is no longer mounted by the panel (`FloatingMic` still uses `useVoice`). It can be deleted once the floating mic is reviewed.

## Backend notes (documented, not changed)

- Render free plan: about 50 s cold start. The panel now shows "slow" and then "reconnecting"; a paid instance or a keep-warm ping removes it.
- The real-mode DB pool goes through the Supabase pooler with the `agent_ro` role, and rate limits are kept in process memory per worker (`WEB_CONCURRENCY=2` doubles the nominal limit). Both are fine at the current scale.

## Final quality bar (honest answers)

1. **40-year-old teacher, no training?** Yes for typing and starters: one surface, plain copy. Voice needs a real-device check.
2. **₹12,000 Android, patchy 4G?** The entry bundle is unchanged and the panel is lazy (78.7 kB gzip). The Devanagari font (120 kB) loads only for हिन्दी. Not yet run on 3G throttling.
3. **Natural Hinglish speech → usable transcript?** Untested here. Server voice (Sarvam) is the better engine; Web Speech `hi-IN` is the fallback.
4. **Hindi renders well?** Yes: Noto Sans Devanagari, line-height 1.7, no letter-spacing or caps (see screenshots 02, 05, 07).
5. **Polished SaaS?** Close. One avatar, 56 px header, 16/22/18 px radii, existing tokens only.
6. **Every visible feature works, no fake steps?** Yes. Steps come only from real `thinking_status` events, the generic "Hum dekh rahe hain…" shows only until the first one, and disabled cards say why.
7. **Responsive on slow internet?** The connection machine handles slow, reconnecting and failed states. Not measured on 3G.
8. **Feels like a4ai?** Existing violet, a4ai copy voice ("aap", "hum"), and Indian-education starters.
9. **Permissions and data boundaries preserved?** Yes: no auth, RLS, billing, route or payload change other than the optional `language`.
10. **Maintainable by 2–3 developers?** Yes: one typed dictionary per language, a parity test, and a harness URL for each state.
