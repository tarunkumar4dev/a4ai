# a4ai Agent UI — notes (6 Nov 2026)

Branch `claude/youthful-archimedes-tw0p0s`. Contract: RAG-BACKEND `agent/schemas.py` 1.1 + `docs/AGENT_PLAN.md`
("API contract additions"). Mirror: `src/lib/agent/events.ts`.

## Where it lives
- **Workspace**: `/dashboard?tab=agent` (inside the staff shell). `/agent` redirects there.
- **Sheet**: the floating "Ask a4ai" button (App.tsx, unchanged mount) on `/dashboard*`, `/institute*`, `/hod*` opens a right
  sheet (440px desktop, full screen on phones) with the same chat. The button hides while the workspace is on screen.
- Staff only: nav item + launcher need `primary_role` admin/hod/proctor/teacher; `AgentWorkspace` shows a lock message
  for anyone else. Students never see it (their routes don't mount the dashboard or the launcher).

## Mount points (the only edits outside our own files)
`src/pages/TeacherDashboardPage.tsx` (4 lines):
```diff
+const AgentWorkspace = lazy(() => import("@/components/agent/AgentWorkspace"));
-    if (tab === "assignments" || tab === "modules") setActiveTab(tab);
+    if (tab === "assignments" || tab === "modules" || tab === "agent") setActiveTab(tab);
+    ...(access && access.primary_role !== "none" ? [{ id: "agent", Icon: Icons.Sparkles, label: "a4ai Agent", color: "text-violet-500" }] : []),
+            {activeTab === "agent" && <AgentWorkspace />}
```
`src/App.tsx`:
```diff
-const AgentPage = lazy(() => import("@/pages/agent/AgentPage"));
-<Route path="/agent" element={<RoleRoute allow={['admin', 'hod', 'proctor', 'teacher']}><AgentPage /></RoleRoute>} />
+<Route path="/agent" element={<Navigate to="/dashboard?tab=agent" replace />} />
```
Deleted (ours): `src/pages/agent/AgentPage.tsx`, `src/components/agent/BlueprintEditor.tsx` (→ `BlueprintCard.tsx`).

## Dependencies
`react-markdown@10.1.0`, `remark-gfm@4.0.1` (exact). `package-lock.json`: 97 packages added, none changed or removed.

## Architecture
- `src/lib/agent/store.ts` — ONE app-wide store (module singleton + `useSyncExternalStore`): active chat (`ChatState` from
  the pure reducer), local chat index, server session list, `/agent/meta`, composer prefill requests. The workspace
  and the sheet both read it, so closing the sheet / switching surfaces never loses a conversation. All network calls
  (stream, approve, PDF, meta, sessions) live here. Cancel on an approval is local only; only Approve calls `/agent/approve`.
- `src/lib/agent/chatState.ts` — reducer extended, not replaced: per-turn `at` / `endedAt`, `steps[]` timeline,
  `feedback` (local only), `stop`, `load`. Steps: `tool.<name>` `{phase:"start"}` → running, `{phase:"done", ms, ok}` →
  done/failed with the server's ms; `status.retrieving_ncert|generating|verifying|regenerating` are steps too (a new
  phase closes the previous one with client-measured ms); `status.thinking|querying` only drive the status line.
  `final`/`end` close running steps, `stop`/`error`/`fail` mark them stopped. Hinglish labels: `stepLabel()`.
- `src/lib/agent/persist.ts` — localStorage per user (`a4ai.agent.v1.<uid>.*`), every access in try/catch. Caps: 30 chats,
  60 turns, ~250 KB per chat (oldest turns dropped). On load a chat is never busy; an approval that was "approving"
  comes back as "failed" with a "check first, then approve again" note (never auto-approved). Cleared on SIGNED_OUT.
- Chat list = local chats ∪ `GET /agent/sessions` (`mergeChatList`). Server-only sessions open with a note that their
  earlier turns aren't on this device; the chat continues with that `session_id`. Rename/Delete are local only (a deleted
  server session id is hidden locally so the list doesn't bring it back).
- `src/lib/agent/surface.ts` — tiny flag so the launcher hides while the workspace is mounted (the dashboard switches tabs
  without changing the URL, so `?tab=agent` alone isn't enough).
- Heavy blocks are separate chunks (`lazyBlocks.tsx`): chart → recharts, paper → KaTeX. An attendance-only chat never loads
  either. Agent chunk ≈ 110 KB gz (mostly react-markdown/micromark + Radix menus), loaded on first open only.

## Components (`src/components/agent/`)
AgentWorkspace (sidebar list lg+, history sheet on phones, fits the dashboard scroll area so the composer is always on
screen) · AgentChatPanel (shared chat column) · AgentHeader (title, role badge, data-source pill, New chat) ·
AgentEmptyState (Namaste + 4 role cards, `roles.ts`) · AgentMessage (user bubble / assistant with mark, StepTimeline,
grouped StatGrid, skeletons, Copy + 👍/👎 + time on hover) · AgentComposer · AgentMarkdown · StatCard/StatGrid ·
AgentChart · DataTable · ClarifyChips · BlueprintCard · PaperPreview · VerificationBadge · ApprovalCard · ErrorCard
(in AgentEventBlock) · AgentSessionList · AgentSheetFrame · SourceFooter · format.ts.

## Decisions
1. **Sheet frame = Radix Dialog directly, z 220/230** (menus/popovers inside at z-240). `ui/sheet` is z-50, below the
   dashboard header/sidebar (150–200), the launcher (105) and the help bubble (110). Focus: composer gets focus on open;
   on close focus returns to the launcher / history button (`returnFocus` — Radix only does this for a `Dialog.Trigger`).
2. **One aria-live region**: a visually hidden status line in AgentChatPanel (running step label, else the status key).
   The visible timeline and "Soch raha hoon…" are not live, so screen readers hear each step once.
3. **Markdown**: `skipHtml`, `img` disallowed, `urlTransform` + `<a>` renderer allow only absolute http(s) → `target=_blank
   rel="noopener noreferrer"`; everything else (javascript:, data:, relative, mailto:) renders as text. No HTML string is
   produced, so DOMPurify isn't needed there; it still sanitizes AgentMath (paper KaTeX, `trust:false`).
4. **Colour exceptions** (no success/warning tokens in `index.css`): emerald-* for "Live · read-only" and a clean
   verification, amber-* for "Demo data", manual review and a non-clean verification — each with `dark:` pairs. Also
   `dark:text-red-400` on destructive TEXT only: dark `--destructive` is 30 % lightness (a background colour) and fails AA
   as text on the dark background. Everything else uses tokens; chart series = `--primary`, `--foreground/55`, …
5. **Verification is never one number**: "Objective x/y · Rubric x/y · Manual review n" + Details popover (manual review,
   failed ids taken from the paper preview, duplicates, marks-sum warning).
6. **Blueprint "Looks good"** sends exactly "Blueprint theek hai, paper banao"; if the teacher edited rows it appends
   ". Badlav: Section B (Short answer): 6 × 2 marks; …". Disabled while the total ≠ the paper total.
7. **Paper actions**: Replace / Easier / Harder send "Q5 (q5) replace|easier|harder karo"; Change marks prefills
   "Q5 (q5) ke marks change karo: ". Approval Edit prefills "Approve se pehle ye badlo: ".
8. **Null is never 0**: stat value null → "—" (unit dropped), table null → "—" (sorted last both ways), chart null → gap
   (`connectNulls={false}`), all-null chart / empty table → friendly empty state. % charts zoom to the data (floor to 10s,
   100 on top) so an 80→84 trend is visible.
9. **Motion**: only colour/opacity; lite.css zeroes durations anyway; spinners (`animate-spin`) keep moving. Charts have
   `isAnimationActive={false}`. Nothing depends on animation to look right.
10. **Help bubble hidden on the agent tab** (it covered the send button on phones): AgentWorkspace renders
    `<style>body:has([data-agent-workspace]) .a4-help{display:none}</style>` — no edit to index.css.

## Tests
- vitest: `src/components/agent/AgentEventBlock.test.ts` (event → component, markdown sanitiser, grouping, contexts, pure
  helpers, launcher), `src/lib/agent/chatState.test.ts` (+ steps), `events.test.ts` (+ 1.1), `persist.test.ts` (new).
- Playwright `tests/e2e/agent.spec.ts` (mocked Supabase + agent SSE): attendance answer (+ follow-up chart/table, sort,
  reload keeps history), clarify (chip → second stream with the session id), trigonometry paper (blueprint edit/total →
  paper + verification → per-question menu → Approve → Download), sheet (open, Esc, focus back, history kept).
  `npx playwright test tests/e2e/agent.spec.ts` works with the default build (every non-app `/agent/*` URL is mocked);
  `VITE_AGENT_URL=http://mock.agent.local` also works. Different local chromium: `PW_CHROMIUM_PATH=/path/to/chrome`.
- Screenshots: `AGENT_SHOTS=1 npx playwright test tests/e2e/agent.spec.ts -g screenshots` → `docs/screenshots/agent-<390|1440>-<light|dark>-<empty|attendance|chart-table|blueprint|paper|approval|sheet>.png` (28 files).

## Fixed after reviewing the screenshots
- 390: composer was below the fold (fixed calc height) → workspace measures its top and fills the scroll area.
- 390: help bubble sat on the send button → hidden on the agent tab.
- 390: agent avatar ate 40px of every answer → hidden under `sm`; 3 stat cards left an orphan → first card spans 2 columns
  when the grid has an odd count (container query, 3 columns from 40rem).
- Chart: y-axis labels were clipped and an 80 % line hugged the top → margins + % domain/ticks.
- Verification line broke mid-phrase in the sheet → parts don't wrap internally; rounds/Details move to their own row.
- Blueprint type column truncated at 390 → narrower number inputs, "Very short" label.
- Desktop: two "New chat" buttons (sidebar + header) → header one hidden on lg in the workspace.

## Known / not done
- **Admins and HODs are redirected away from `/dashboard`** by the dashboard's existing rule (home_route ≠ /dashboard and no
  teaching batches → navigate to /institute or /hod), so `/agent` → `/dashboard?tab=agent` bounces them. They use the sheet
  on /institute and /hod. Fix (one line, not done — outside the allowed mount points): skip that redirect when `tab=agent`.
- Server-only sessions have no messages endpoint, so their earlier turns can't be shown.
- 👍/👎 stay on this device (no feedback endpoint). Hindi UI not added (Hinglish copy only).
- Esc inside the rename field of the phone history sheet may also close the sheet (Radix listens on the document; not tested).
- No math rendering inside assistant prose (only in the paper).
