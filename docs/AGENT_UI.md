# a4ai Agent UI — v2 (history, search-style input, message actions)

Branch `claude/youthful-archimedes-tw0p0s`, PR #21. v1 notes (blocks, colours, sheet z-index, markdown rules):
[`AGENT_UI_NOTES.md`](AGENT_UI_NOTES.md) — still valid unless this file says otherwise.

## Contract
`docs/AGENT_API_V2.md` (RAG-BACKEND) was not published when this was built (checked every RAG-BACKEND branch on
9 Nov). The UI is built against `src/lib/agent/types.ts`, which is the single place for every type, and the mock adapter
`src/lib/agent/mock.ts` follows it exactly. Where the brief named an endpoint but not its shape, we picked one —
marked **assumed** below. The backend should either match these or tell us, and we change `types.ts` + the parsers.

| Endpoint | Shape used |
|---|---|
| `GET /agent/sessions?cursor&limit&q&pinned` | `{ sessions: [{session_id, title, created_at, updated_at, pinned}], next_cursor }`. v1 shape (no cursor/pinned) still parses. |
| `GET /agent/sessions/{id}/messages?cursor` | **assumed** `{ messages: [{seq, role, created_at, text? (user), events? (assistant), stopped?, feedback?, request_id?}], next_cursor }`, oldest→newest inside a page, `next_cursor` pages to OLDER messages. Assistant messages carry the exact events they streamed. |
| `PATCH /agent/sessions/{id}` | body `{title?, pinned?}` → the session (or empty). |
| `DELETE /agent/sessions/{id}` | — |
| `GET /agent/history/queries?q&limit` | **assumed** `{ queries: [{id, text, created_at}] }` newest first (a bare array also parses). |
| `DELETE /agent/history/queries/{id}`, `DELETE /agent/history/queries` | — |
| `GET /agent/suggestions?q&limit` | `[{type: recent\|template\|entity, text, hint}]`; **assumed** optional `id` on `recent` (for the X). `{suggestions: [...]}` also parses. |
| `POST /agent/feedback` | **assumed** `{session_id, message_seq, rating: "up"\|"down"\|null, note?}`. |
| `POST /agent/chat/{request_id}/cancel` | body `{}`. |
| `POST /agent/chat` | `{session_id?, message, regenerate_from_seq?, edit_of_seq?}` — v2 fields only sent when set. |
| SSE `session` | `{session_id, title}` — first event of a stream. |
| SSE `my_scope` | **assumed** `{source, as_of, role, title?, batches: [{batch_id, name, students, kind?, department?, via?}], total_students, departments?}`. |
| SSE `section_comparison` | **assumed** `{source, as_of, title, metric, unit?, period?, higher_is_better?, rows: [{name, value, students?, detail?, id?}]}`. |
| `clarify.chips[].hint` | optional, e.g. "Section · 22 students". |
| `GET /agent/meta` `.scope` | **assumed** optional `{batches, total_students}` for the empty state ("2 batches · 44 students"). |

**Message `seq` (assumed):** every message in a session takes the next integer (user 1, assistant 2, user 3 …).
The client counts the same way for messages it streamed itself, so Regenerate / Edit can send a seq without reloading.
If the backend numbers differently, the `session` event (or `final`) should carry the seqs of the new messages.

## Data layer (Phase 1)
- `src/lib/agent/api.ts` — `AgentApi` interface, `httpApi` (VITE_AGENT_URL, Supabase token, dev `X-Dev-Role`),
  `getAgentApi()` picks `mockApi` only when `VITE_AGENT_MOCK=1` (dynamic import inside an env-constant branch, so the
  mock chunk is not emitted in normal builds). `isMissingEndpoint()` = 404/405/501 → features degrade instead of erroring
  on today's v1 backend.
- `src/lib/agent/queries.ts` — TanStack Query (the app's data layer). Keys `["agent", uid, "sessions", {q, pinned}]`,
  `["agent", uid, "queries"]`, `["agent", uid, "suggest", q]`. Pinned list = one request (≤ 50); the rest = infinite
  query (20 per page). Mutations are plain async functions (testable without React): rename/pin = snapshot → cache →
  PATCH → rollback on error; delete = remove now, DELETE after 5 s unless Undo; `pagehide` sends pending deletes
  with `keepalive`. Signing out removes every `["agent", uid]` query.
- Suggestions: input debounced 120 ms; TanStack aborts the previous request through its `AbortSignal` when the key
  changes; each query is cached 60 s (`staleTime`) / 5 min (`gcTime`); `placeholderData` keeps the last list on screen
  while the next one loads. Ranking and highlighting are client-side (`suggest.ts`) so local recents and templates
  merge with the server list and the order is stable.
- `src/lib/agent/replay.ts` — stored messages → `ChatState` through the same reducer the live stream uses, so an
  opened chat renders exactly as it did live; block ids = `${request_id}-${seq}` (stable).
- `src/lib/agent/mock.ts` — in-browser fake (localStorage `a4ai.agent.mock.v2`), 45 seeded sessions (2 pinned),
  8 recent queries, scenarios by message text (see the file header). `window.__AGENT_MOCK_LATENCY__` sets REST latency.
- No request/response body, query text or student data is logged anywhere (no `console.*` in the agent code).

## Chat history (Phase 2)
- **Source of truth = server.** Opening a chat shows this device's cached copy at once (if any), then replaces it with
  `GET …/messages` (all pages, oldest first, ≤ 25 pages) replayed through the reducer. Server unreachable + cache →
  "Server se nahi mila — ye is device par saved copy hai"; v1 backend (404/405) and no cache → "purani baatein yahan
  nahi dikh sakti", and the chat continues with that session id. The cache (`persist.ts`, 30 chats, 250 KB each) is
  keyed by session id; a new chat uses a temporary `c-…` key until the `session` event, then moves.
- **Last open chat** = `index.activeKey` in localStorage; `init()` reopens it after a refresh.
- **New sessions** are put at the top of every cached list from the `session` event (`placeSession`) — no refetch per
  message. Search caches only get it when the title matches.
- **Groups** use the local calendar day (Today / Yesterday / Previous 7 days / Older); Pinned always first. A chat that
  shows up in both the pinned and the rest list (a pin racing a page load) is shown once.
- **Search** = server `q` (debounced 200 ms) plus an instant local filter of what's loaded (every word, any order,
  accents ignored), so typing never shows an empty list while the request runs.
- **Windowed list**: fixed row heights (header 32 px, chat 48 px), offsets + binary search (`windowByOffsets`), 6 rows
  overscan. Infinite scroll fetches the next page when the rendered window is within 4 rows of the end.
- **Delete** = confirm dialog → removed at once → toast with Undo (5 s) → DELETE. Deleting the open chat starts a new
  one; Undo reopens it. `AgentConfirm` is our own Radix AlertDialog at z 245/250 (ui/alert-dialog is z-50, under the
  sheet).
- **Collapsible panel** on lg+ (remembered per user: `a4ai.agent.v1.<uid>.pref.historyCollapsed`); below lg the
  history is a left drawer. In the sheet, the history icon opens a drawer *inside* the sheet.
- **Esc order** (`escLayer.ts`): an element with `data-agent-esc-layer` (open suggestions, rename box, edit box,
  non-empty search, the in-sheet drawer) handles Esc itself; `AgentSheetFrame` cancels Radix's dismiss while one is
  present. So: first Esc closes the inner thing, the next closes the sheet.
- Rows are disabled (except the open one) while an answer streams.

## Search-style input (Phase 3)
- ARIA 1.2 combobox: the textarea has `role=combobox`, `aria-expanded`, `aria-controls`, `aria-autocomplete=list`,
  `aria-activedescendant`; the popup is a `listbox` with `group`s (Recent / Try / matches) of `option`s. The ×
  and ↖ buttons inside an option are `tabIndex=-1` (mouse/touch); keyboard users use Tab/→ to fill and
  **Shift+Delete** to remove a recent item (as in Chrome's address bar).
- The list opens when the USER focuses the box (click / Tab), types, or presses ↓ — never when code moves focus
  (sheet opening, Ctrl+K, focus coming back after an answer), so it doesn't pop over the answer.
- Closed while busy, while the text has a newline, and after Esc until the next keystroke.
- Opens upwards (the composer is at the bottom), full width, `max-h: min(55vh, 420px)`, rows ≥ 44 px — on phones it is
  the "bottom sheet" above the keyboard. `onMouseDown` on the popup is prevented so the caret stays in the box.
- Clear history = confirm → `DELETE /agent/history/queries` (optimistic, restored on error). Chats are not touched.

## Message experience (Phase 4)
- **Regenerate** on every assistant message (title warns that later turns go when it isn't the last): truncates
  locally and sends `regenerate_from_seq` = that message's seq. **Edit** on user messages: inline editor, Enter sends,
  Esc cancels; sends `edit_of_seq`. Without a known seq (v1 chat) the same text is simply sent again.
- **Stop**: aborts the fetch and sends `POST /agent/chat/{request_id}/cancel` (best effort; request_id = the stream's
  first event). The partial answer stays, marked "Aapne rok diya — jawab adhoora hai", with Copy/Regenerate.
- **Feedback**: 👍 / 👎 send at once; 👎 also opens an optional note (500 chars) that is sent as a second call. A failed
  call restores the previous state + toast; a missing endpoint keeps it on this device silently.
- **Timeline**: an icon per tool (`STEP_ICON`), fixed 24 px rows so the answer below doesn't jump, duration / ✗ /
  "ruka" on the right; collapses to "3 steps · 4.2s" when done.
- **ScopeCard**: tap a batch = send "`<name>` ki attendance"; ✎ = put that in the box to edit first. >8 batches →
  "Sab N dikhao".
- **SectionComparison**: competition ranking (ties share a rank: 1, 1, 3), sections without data rank last as "—"
  with their detail line; Top / Sabse kam summary; the bar chart reuses the lazy recharts chart (nulls are gaps).
- **Clarify hints**: a chip with a hint becomes a two-line chip (label + muted hint).
- **Empty state**: "Namaste, `<first name>`", "Aapke paas: 2 batches · 44 students" (only when `/agent/meta` sends
  `scope`), 4 cards = up to 2 of the caller's largest non-lab batches, "Mere sections compare karo" when there are 2+,
  then role templates (no repeats).
- **Shortcuts** (wired once, in `AskA4aiLauncher`, which is mounted on every dashboard route): Ctrl/⌘+K opens the sheet
  (or focuses the workspace box), Ctrl/⌘+Shift+O new chat, "/" focuses the box when the agent is on screen and you
  aren't typing elsewhere. Listed in the ⌨ popover in the header (hidden below sm — phones have no keyboard shortcuts).
- **Errors**: inline ErrorCard with Retry (as before) + a failed chat load gets its own Retry; offline banner above
  the composer (typing works, Send waits; uses the app's `useNetworkStatus`); 401 → "Session expire ho gaya · Sign in
  again": saves the box text (or the last question) to sessionStorage, remembers the page, goes to /login, and the
  composer puts the text back after the login returns here.
- **Long chats**: turns above the last 6 get `content-visibility: auto` + `contain-intrinsic-size: auto 320px` (the
  browser remembers each turn's real height once rendered). The scroller has `overflow-anchor: none` and sticks to the
  bottom only while you're within 120 px of it.

## Quality bar (Phase 5)
- **One live region**: the visually hidden status line in `AgentChatPanel` (`liveStatus`). While streaming it says the
  running step; after a turn it announces a fresh error, a stop, a failed approval or an expired session. Error cards,
  the approval error and the session prompt no longer use `role="alert"` (which is a second, assertive live region).
  Replayed (old) turns are never announced. The app-wide sonner toaster is outside the agent and keeps its own region.
- **Focus**: sheet → composer on open, back to the launcher on close; history drawer (phone) → Radix focus trap, back to
  the history button; in-sheet history drawer → search box on open, back to the history icon on close; New chat /
  Ctrl+K / "/" → composer; Edit → its textarea, Esc → back to the Edit button; collapse/expand keep focus on the
  toggle.
- **Contrast**: an e2e audit (`contrast:` in `tests/e2e/agent-v2.spec.ts`) computes every visible text's colour against
  its composited background in light and dark and fails below 4.5:1 (3:1 for large text). It found the app's own
  `--muted-foreground` on `--background` (98 % lavender) at **4.44:1** — so the agent surfaces (workspace, chat column,
  header, composer, sheet, drawers, chips, table cards) now sit on `bg-card` (white / dark card), where it is 4.76:1.
  Active rows (history, highlighted suggestion) use `text-accent-foreground/75` for their time / hint. Tokens only.
- **Reduced motion**: nothing animates except spinners (lite.css already zeroes transitions); charts have animation off.
- **Performance**: history list windowed (above); long chats use content-visibility; no layout shift while streaming:
  fixed-height timeline rows, skeletons sized like the first block, `overflow-anchor: none` + stick-to-bottom only when
  you are already at the bottom. The mock adapter is a separate chunk that only a `VITE_AGENT_MOCK=1` build emits.

## Tests
- vitest — `src/lib/agent/v2.test.ts` (parsers, ranking + highlighting, combobox keys, history grouping + windowing,
  optimistic rename/pin/delete + rollback + undo, recent queries, reducer regenerate/edit/stop/feedback, replay, mock
  contract incl. cancel) and `src/components/agent/v2blocks.test.ts` (my_scope / section_comparison / clarify hints
  → components, rankRows, empty-state cards, message actions, listbox markup, shortcuts, step icons, live region).
- Playwright, mock adapter — `npx playwright test -c playwright.agent-mock.config.ts` (builds `dist-e2e-agent` with
  `VITE_AGENT_MOCK=1`; `E2E_REUSE=1` serves an existing build). `tests/e2e/agent-v2.spec.ts`: history + replay +
  restore + search + infinite scroll · rename/pin/delete + undo · suggestions with the keyboard · remove + clear
  history · stop + regenerate + 👎 note + edit · my_scope + section_comparison · mobile sheet (drawer, Esc order,
  Ctrl+K) · contrast audit. The default `playwright.config.ts` ignores this spec (it needs the mock build).
- Playwright, real HTTP adapter with mocked network — `tests/e2e/agent.spec.ts` (v1 flows) still runs on the default
  config; its history assertion now uses the new panel.
- Screenshots: `AGENT_SHOTS=1 npx playwright test -c playwright.agent-mock.config.ts -g screenshots` →
  `docs/screenshots/v2/agent-v2-<390|1440>-<light|dark>-<name>.png`.

## Files outside the agent folders
| File | Change | Why |
|---|---|---|
| `playwright.config.ts` | +1 line `testIgnore: /agent-v2\.spec\.ts$/` | that spec needs the mock build |
| `playwright.agent-mock.config.ts` | new | builds + serves the `VITE_AGENT_MOCK=1` bundle for the v2 spec |
| `tests/e2e/agent.spec.ts` | 1 assertion | history panel testid changed |
| `CLAUDE.md` | progress-log entry | repo rule |
No page, route, mount point, migration or Supabase call outside `src/components/agent` / `src/lib/agent` changed in v2.

## Blocked on / to confirm with the backend contract (v2)
1. Everything marked **assumed** in the contract table — above all the messages shape (`events[]` per assistant
   message) and the per-session `seq` numbering used by `regenerate_from_seq` / `edit_of_seq` / feedback.
2. `my_scope` / `section_comparison` event shapes and `/agent/meta.scope` (the empty-state summary is hidden without it).
3. Approval state isn't in stored messages: a reopened chat shows a past approval as pending (until it expires) —
   needs `approval_state` on the stored message, or the approval endpoint must stay idempotent.
4. Today's live backend (v1) has none of the v2 endpoints: history lists (v1 shape parses), but messages, recent
   queries, suggestions (local ranking only), feedback (kept on this device), cancel (the abort still stops reading),
   rename/pin/delete (rolled back with "Server abhi ye support nahi karta") degrade as described above.

---

# v3 — contract-first rewrite (10 Nov 2026)

All types generated from `RAG-BACKEND docs/agent_openapi_v2.json` (contract 1.2, commit 957ceac). The v2
**assumed** notes are gone; every shape now matches the backend or is marked "not in 1.2".

## Phase 0: Contract codegen

- `npm run agent:contract` (`scripts/agent-contract.mjs`) copies or fetches the OpenAPI spec, runs
  `openapi-typescript` 7.4.4, writes `src/lib/agent/api.gen.ts`. Snapshot: `src/lib/agent/contract/agent_openapi_v2.json`.
- `types.ts` re-exports `components["schemas"]` via `Schemas` type alias. `ContractEvent` = discriminated union
  from `MessageItem.events[number]`. Only two hand-typed: `AgentMeta` (no OpenAPI model) and `FileEvent` (pending).
- `contract/fixtures.ts`: typed `Fixtures` mapped type (compile error on a new backend event type), one realistic
  fixture per 13 event variants + `SCOPE_TABLE`, `RANKING_TABLE`, `FILE_FIXTURE`.
- `contract.test.ts`: reads the JSON at runtime, asserts 13 schemas = 13 fixtures = `EVENT_TYPES` (+ `file`);
  SSE decode round-trip; every event → block → renders (via `renderToStaticMarkup`).
- Exhaustive `never` in `chatState.eventToBlock` and `events.EVENT_TYPES`.

## Phase 1: Privacy

- **Zero chat content on this device.** No localStorage / sessionStorage / IndexedDB of message text, feedback
  notes, query text, or answer blocks. Allowed: `a4ai.agent.v3.<uid>.pref.historyCollapsed`, `.lastSession`.
- `persist.ts`: only `loadPref` / `savePref`; `purgeLegacyAgentStorage` (v1 caches, v2 mock key, pendingDraft)
  runs on init; `clearAgentStorage` (all `a4ai.agent.*`) on logout / user switch.
- `privacy.test.ts`: full conversation (send → answer → 👎 note → reopen → regen → file) — spied
  `Storage.setItem` writes only pref keys, no message/query text; IndexedDB never opened; user switch drops
  previous user's TanStack queries + prefs + chat.

## v2 → v3 mismatch list (what changed from the assumed shapes)

| Area | v2 (assumed) | v3 (contract 1.2) |
|---|---|---|
| **Sessions list** | `{ sessions: [{session_id, …}], next_cursor }` | `{ items: [{id, title, created_at, last_message_at, message_count, pinned, preview}], next_cursor }` (+ `sessions` legacy fallback) |
| **Messages list** | `{ messages: [{seq, …, feedback?}], next_cursor }` | `{ items: [{seq, role, text, events, created_at}], next_cursor }` ascending, limit ≤200 |
| **Queries** | `{ queries: [{id, text, created_at}] }` | bare array `[{id, text, last_used_at, use_count}]` |
| **Suggestions** | `[{type, text, hint, id?}]` | bare array `[{type, text, hint}]` — no `id`; hints = "Recent · 3×", "Batch · 22 students", "Starter" |
| **Feedback** | `{session_id, message_seq, rating: up\|down\|null, note?}` | `rating` = `up\|down` only (no `null` = no clear); not returned in messages → can't restore 👍/👎 on reload |
| **Cancel** | `POST /agent/chat/{request_id}/cancel` | same; response `{request_id, cancelled}`, stream ends with `final.cancelled: true` |
| **my_scope** | dedicated SSE event `{batches, role, …}` | `table` event with `source: "tool:my_scope"`, columns `[Batch, Students, Role, Subjects]` |
| **section_comparison** | dedicated SSE event `{rows: [{name, value, …}]}` | `table` with `source: "tool:section_comparison"`, columns `[#, Class, %, Classes held, Marked]` + optional `chart` |
| **meta.scope** | `{batches, total_students}` for empty state | **does not exist** — empty state uses `useMyScope` batch names (no student counts) |
| **Session event** | first in stream | always first; `final` always last (even after error) |
| **Title** | unlimited | ≤48 chars, auto-generated by `store.py:auto_title` (cut at word, strip punc, "…") |
| **Regenerate** | sends `regenerate_from_seq` + message text | `regenerate_from_seq` only (message ignored); new seq = max+1 |
| **Edit** | sends `edit_of_seq` on user message | `edit_of_seq` on assistant → 422 |
| **file event** | assumed `{file_id, name, …}` | **NOT in 1.2**; UI ready with local `FileEvent` type |
| **`/agent/files/{id}`** | download endpoint | **NOT in 1.2** |
| **Approval persistence** | stored in messages | **NOT in 1.2** — UI expires past approvals on replay |
| **Excel export** | file event → download | **NOT in 1.2**; mock emits file events |
| **503 (no LLM key)** | error card | backend returns 503 when `A4AI_ANTHROPIC_API_KEY` / `GEMINI_API_KEY` not set |
| **Chat caching** | 30 chats in localStorage, 250 KB each | **removed** (Phase 1 privacy); source of truth = server only |

## Blocked on (v3)

1. **Feedback not replayed.** `GET .../messages` doesn't return feedback → 👍/👎 reset on reload. Backend needs
   `feedback` field on `MessageItem` or a `GET /agent/sessions/{id}/feedback` endpoint.
2. **File event / download.** UI ready; needs backend `file` event + `GET /agent/files/{id}` (or signed URL in the event).
3. **Approval persistence.** A reopened chat shows past approvals as expired. Needs `approval_state` on stored
   `pending_approval` events.
4. **Excel export.** Teacher "below 75%, Excel mein" — needs file event in the backend.
5. **Meta scope.** Empty state shows batch names from `useMyScope` (no student counts). A `scope` field on
   `/agent/meta` would restore "2 batches · 44 students".
6. **Real-backend e2e.** `A4AI_ANTHROPIC_API_KEY` not set → 503. Needs a scripted LLM provider (like
   `tests/agent/test_agent_v2.py:Scripted`) or a dev-mode endpoint that accepts a pre-written response.


## Voice (contract 1.4)
Code: `src/lib/voice/*` (pure logic + browser wiring), `src/components/voice/*` (lazy UI), mounted from
`AgentChatPanel` (dock above the composer) and `AskA4aiLauncher` (floating mic, `ui_action` navigation). Backend
spec: RAG-BACKEND `docs/VOICE_PLAN.md`. Voice prefs (speaker, speed, mute, consent timestamp + version) live in
`a4ai.agent.v3.<uid>.pref.voice` and are cleared with the other agent prefs on sign-out. The route registry copy is
refreshed with `npm run agent:routes` (set `AGENT_BACKEND_DIR` when the backend is not at `../RAG-BACKEND`).
