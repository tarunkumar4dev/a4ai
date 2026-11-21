# a4ai Agent: UI redesign, three languages, and voice input. G0 audit and plan

Branches: `feat/agent-ui-i18n` in both repos (worktrees `Downloads\worktrees\fe-agent-ui-i18n` and `be-agent-ui-i18n`).
Base: `claude/youthful-archimedes-tw0p0s`, because the agent panel is not on `main` yet. Nothing is pushed.

## A. Architecture (what is really there)

```
App.tsx
├─ AskA4aiLauncher (eager, on every dashboard route; owns Ctrl+K)
│   ├─ LazyFloatingMic (lazy voice chunk, phones)
│   └─ AgentSheetFrame (Radix Dialog, z 230, sm:w-[440px], full screen on phones)
│       └─ lazy AgentChatPanel variant="sheet"   ← chunk AgentChatPanel-*.js
│           ├─ AgentHeader (AgentMark + "a4ai Agent" + role badge + DataSourcePill + chat title + ShortcutsHelp + New chat)
│           │   leading = History button (opens SheetHistory drawer), trailing = Close
│           ├─ scroller: load skeleton | ErrorCard | AgentEmptyState | AgentMessage[] (content-visibility above the last 6)
│           │   AgentMessage → StepTimeline (real thinking_status events) + AgentEventBlock → result blocks
│           │   (StatCard, DataTable, RankingTable, AgentChart, PaperPreview, FileCard, ApprovalCard, ClarifyChips, …)
│           ├─ sr-only aria-live status (liveStatus)
│           └─ footer: offline note · SessionExpired · LazyVoiceDock · AgentComposer (+ AgentSuggestions combobox)
└─ TeacherDashboardPage ?tab=agent → lazy AgentWorkspace (AgentHistoryPanel sidebar + AgentChatPanel variant="page")
```

- **State:** `src/lib/agent/store.ts` is a singleton external store (`useSyncExternalStore`) plus `chatReducer` (`chatState.ts`). Both surfaces share one conversation. The composer draft is kept in memory (`agentStore.composerText`).
- **Persistence:** server-owned sessions (`GET /agent/sessions`, `/messages`). Only small prefs go in localStorage (`persist.ts`). React Query handles history and suggestions.
- **Streaming:** `fetch` POST `/agent/chat`, which returns SSE parsed by `readSse` (`api.ts`). Events are batched once per animation frame (`enqueue`/`drain`). Stop is an AbortController plus `POST /agent/chat/{request_id}/cancel`.
- **Request body** (`chatBody`): `{session_id, message | regenerate_from_seq, edit_of_seq?, cancel_current?}`. Voice requests add `{tts, speaker, pace}`.
- **Errors:** `friendlyError()` maps 401/403/404/410/422/429 (Retry-After countdown)/503/5xx/network/offline to Hinglish text and a code, and `ErrorCard` adds Retry. A 401 shows `SessionExpired`, which signs in in a new tab.
- **Markdown:** `react-markdown` with `skipHtml`, no images, http(s) links only. There is no `innerHTML`.

## B. Backend

- **Location:** this workspace, `RAG-BACKEND/agent/` (FastAPI `agent.api:app`). It is deployed on **Render** (`a4ai-agent.onrender.com`), not Vercel serverless. It is a long-running process with no serverless timeout, two workers, and a free plan (cold start about 50 s).
- **Request model:** `agent/schemas.py::ChatRequest` (`extra="forbid"`). `agent/voice/api.py::VoiceChatRequest(ChatRequest)` inherits from it, so one field added to `ChatRequest` covers both.
- **Language today:** the system prompt says "Reply in the user's script" (`core.py::system_prompt`). There is no request field for it. The `speech` event already carries `language: hi|en|hi-en`.
- **STT already exists:** `POST /agent/voice/transcribe` (Sarvam STT, with a Gemini fallback). It is gated by `GET /agent/voice/config` → `enabled` (`VOICE_ENABLED`), and the key is already in the project. Recording runs through `lib/voice/recorder.ts`, which has VAD, `SILENCE_AFTER_SPEECH_MS = 2500` and `MAX_MS = 30_000` (the Sarvam REST limit).
- **Limits:** a per-user turn rate and a per-institute daily token budget (`agent/rate_limit.py`, 429 with Retry-After), and `MAX_LLM_STEPS = 10`. There is **no 20-message cap** and no per-IP limit in the agent. Those come from the test-generator API, not this one.
- **Auth:** a Supabase JWT, from which `SessionCtx` (role, institute) is built server-side, and the read-only `agent_ro` DB role in real mode. Nothing here changes.
- **Tools** (`agent/tools`): my_scope, attendance stats/trend/low list, marks_stats, section_comparison, tests_created_by_teacher, test-paper drafts (blueprint → approval → paper → PDF/DOCX), and Excel export.

## C. Design system

- Tailwind + shadcn tokens (`src/index.css`): `--primary: 265 80% 52%` (violet, the same in dark), `--radius: .5rem`, and card/muted/border/ring tokens. Dark mode uses `class` (next-themes).
- Font: Plus Jakarta Sans (`font-halenoir` alias), self-hosted woff2, Latin only. **There is no Devanagari font.** Devanagari currently falls back to system fonts.
- Icons: lucide-react (stroke 2). UI parts: shadcn Button/Popover/DropdownMenu/Tooltip/Dialog. Animations: tailwindcss-animate.
- Breakpoints: Tailwind defaults (sm 640, lg 1024).
- i18n: `i18next`/`react-i18next` are installed, but `src/i18n.ts` is **imported nowhere** (dead stub) and `LanguagePicker` says "coming soon". So the app has no working i18n to reuse.

## D. Performance baseline (prod `vite build`, before)

| Chunk | raw | gzip |
|---|---|---|
| Entry `main-*.js` | 492,058 B | 147,399 B |
| `chunkReload-*.js` (entry dep) | 149,694 B | 48,528 B |
| `AgentChatPanel-*.js` (lazy) | 253,970 B | 75,880 B |
| `VoiceDock-*.js` (lazy) | 28,527 B | 9,210 B |
| `AgentWorkspace-*.js` (lazy) | 4,907 B | 2,280 B |

The panel is already lazy. `AskA4aiLauncher` (eager) imports only small modules. Meta is fetched once per user, with no polling.

## E. Root causes of the 8 defects

1. **Permanent "Connecting…":** `dataSourcePill()` renders "Connecting…" for **both** `loading` **and** `error`. `refreshMeta()` runs once at store init and then only after a *successful* chat turn. It has no timeout, no retry and no backoff. So any unreachable agent (prod with `VITE_AGENT_URL` unset → `http://localhost:8000`, a cold Render start, or the stuck-port case) shows "Connecting…" forever. `fetch` with no timeout can also hang on a socket that accepts but never serves.
2. **Duplicate prompts:** the empty-state cards (`emptyCards`) and the composer's idle popover (`idleOptions(recent, templates)`, "Ye poochiye" section) both draw from `SUGGESTIONS[role]`. The popover opens on focus or tap of an empty input, and it overlaps the cards.
3. **No-batch dead end:** `scopeLine()` returns the negative text, and `emptyCards()` never looks at capability, so teachers with no batch still get attendance and marks cards.
4. **Header:** an `AgentMark` (sparkle tile) in the header plus the `/ICON.ico` logo in the empty state make two marks. There's also the role badge, a `Keyboard` icon with no visible label, and the pill.
5. **Small text:** 15 uses of `text-[11px]`, 7 uses of `uppercase` (suggestion headings, cards). The keyboard hint is shown under `sm:` (width), not by pointer type, so tablets and touch laptops see it.
6. **No i18n:** every string is a Hinglish literal across about 25 files.
7. **Voice:** it exists, but appears **only** when `/agent/voice/config` says enabled (off in prod, and unreachable anyway). It **auto-sends** after 5 s (`AUTO_SEND_PAUSE_MS`), which this spec forbids. There's no fallback when server STT is off.
8. **Other:** error text includes "HTTP 503" (a raw code). Streaming auto-scroll pauses when you scroll up, but there's no "Jump to latest" pill. `aria-busy` is missing. The panel is 440 px with no expand option. There's no `lang` attribute.

## Decisions and assumptions (each one reversible)

1. **i18n layer:** a small typed layer in `src/lib/agent/i18n/`, following the repo convention (`lib/agent`, `lib/voice`). There's no `src/features` folder. The dead i18next stub is not used. It doesn't use React context: `useAgentT()` reads an external store, so a language switch re-renders only text and never remounts. The dictionaries are plain TS objects in the agent chunk (about 4 kB gzip each, all three bundled, so a switch fetches nothing).
2. **Language field:** `language: Literal["en","hi","hinglish"] = "hinglish"` on `ChatRequest`. The frontend sends it only when it is not `hinglish`, so the old backend still accepts the default case. **Deploy backend first.**
3. **Prompt line:** one line is appended at the *end* of the system prompt, so the cached prefix (tools plus most of the system text) stays shared.
4. **Voice, two engines behind one mic:**
   - (a) If the server voice is enabled, use the existing Sarvam path (better Hinglish, key already present).
   - (b) Otherwise use the Web Speech API (`SpeechRecognition`, free), with `lang` taken from the UI language as a hint (`en-IN`, or `hi-IN` for both Hindi and Hinglish).
   - With neither available, the mic is hidden.
   - In both cases the transcript goes into the composer and is **never auto-sent**. When a transcript from server voice is sent unedited, it goes out as a voice turn, so spoken answers keep working. Edited text goes out as a normal turn.
   - Sarvam keeps its 30 s cap, because the backend rejects longer audio. Web Speech gets 60 s.
5. **Devanagari font:** Noto Sans Devanagari (OFL), self-hosted as one woff2 in `public/fonts/`. It's injected as an `@font-face` only when `hi` is selected or Devanagari text is rendered, with `font-display: swap` and a `size-adjust`ed local fallback. It is not an npm dependency, and no Google Fonts request is made at runtime.
6. **Preview harness:** `/__agent-preview` is added in `App.tsx` behind `import.meta.env.DEV`, so Vite drops it from prod (checked with grep on `dist`). It uses the existing typed mock (`lib/agent/mock.ts`) plus fixture switches for each state. No credentials are needed.
7. **No contract change** other than `language`. History, feedback, regenerate and edit stay on their existing endpoints. There is no message cap in the agent, so `error.msgcap` copy exists but is shown only if the backend ever answers with that code.
8. The PR branch `claude/youthful-archimedes-tw0p0s` stays as it is. This branch stacks on it.

## Files to change (by gate)

| Gate | Files |
|---|---|
| G1 | new `src/lib/agent/i18n/{types,en,hi,hinglish,index}.ts`, `i18n.test.ts`; `AgentHeader` (lang menu); `api.ts::chatBody` + `types.ts` (`language`); `App.tsx` + new `src/pages/AgentPreview.tsx`; backend `agent/schemas.py`, `agent/core.py`, `agent/api.py`, `agent/voice/api.py`, tests |
| G2 | `AgentHeader`, `AgentEmptyState`, `roles.ts`, `AgentComposer`, `AgentSuggestions`, `AskA4aiLauncher`/`AgentSheetFrame` (width, expand), `ShortcutsHelp` → overflow |
| G3 | `lib/voice/webSpeech.ts` (new), `lib/voice/session.ts`/`useVoice.ts` (no auto-send → composer), `VoiceDock`, `MicButton`, `AgentComposer` (mic slot) |
| G4 | `store.ts` (connection machine: timeout, backoff, slow at 8 s, `retryMeta`), `AgentChatPanel` (status strip, jump-to-latest, aria-busy), `friendlyError` (no HTTP codes) |
| G5 | `AgentMessage` (layout, actions visible on touch), result-card chrome (light restyle only, data shapes unchanged) |
| G6 | `index.css` (Devanagari rules), `lib/agent/i18n/font.ts`, panel `lang` attrs, mobile `visualViewport`, focus/Esc |
| G7 | build report before/after |

## Risks

- Hindi and Hinglish e2e selectors: the default stays Hinglish with the current copy, so existing tests keep passing.
- An old backend plus a new frontend with a non-default language gives a 422. That's why the backend deploys first and the field is sent only when it isn't the default.
- Web Speech in Chrome sends audio to Google's service. This is stated in the voice consent text. Server voice (Sarvam) is preferred when enabled.
- The worktree shares `node_modules` through a junction (see memory). It must be removed safely.

## Task list

- [x] G0 audit + plan
- [ ] G1 i18n layer, language menu, `language` param (backend + frontend), preview harness, parity tests
- [ ] G2 header, empty state (one suggestion surface, capability-aware), composer, 420/720 panel
- [ ] G3 voice: Web Speech fallback, no auto-send, all states
- [ ] G4 connection state machine, jump-to-latest, error copy
- [ ] G5 message layout and actions, card chrome
- [ ] G6 a11y, Devanagari typography and lazy font, mobile
- [ ] G7 bundle report
- [ ] G8 browser matrix + screenshots → WALKTHROUGH.md
