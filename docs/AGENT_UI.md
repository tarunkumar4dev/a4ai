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
