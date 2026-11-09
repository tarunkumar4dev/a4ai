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

## Blocked on / to confirm with the backend contract
1. Everything marked **assumed** in the contract table — above all the messages shape (`events[]` per assistant
   message) and the per-session `seq` numbering used by `regenerate_from_seq` / `edit_of_seq` / feedback.
2. `my_scope` / `section_comparison` event shapes and `/agent/meta.scope` (the empty-state summary is hidden without it).
3. Approval state isn't in stored messages: a reopened chat shows a past approval as pending (until it expires) —
   needs `approval_state` on the stored message, or the approval endpoint must stay idempotent.
4. Today's live backend (v1) has none of the v2 endpoints: history lists (v1 shape parses), but messages, recent
   queries, suggestions (local ranking only), feedback (kept on this device), cancel (the abort still stops reading),
   rename/pin/delete (rolled back with "Server abhi ye support nahi karta") degrade as described above.
