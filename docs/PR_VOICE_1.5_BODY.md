# PR: a4ai Agent + Voice UI (contract 1.5) and the Gate 2 cost fixes

Branch `claude/youthful-archimedes-tw0p0s` → `main` (main already merged in: offline attendance from PR #22 is included). 37 commits, ~350 files (about half are screenshots under `docs/`).

## What changes for live users

| Area | Change | Risk |
|---|---|---|
| Worksheets | `generate-direct` / `generate-worksheet` now send the login token (the backend starts requiring it) | **deploy this before the backend PR**; with the old backend the extra header is ignored |
| Test papers | one `Idempotency-Key` per attempt, reused when the same form is resent after a failure (a lost response no longer makes a second paper); 409 → "already generated, see History"; 503 shows the backend's Hindi/English message | none with the old backend (header ignored) |
| Edge function | `supabase/functions/generate-test` removed from the repo (no caller; its embedding model shut down 14 Jan 2026). **Still deployed** — delete it in Supabase: `npx supabase functions delete generate-test --project-ref dcmnzvjftmdbywrjkust`, then unset `OPENAI_API_KEY` if nothing else uses it | none |
| Agent UI | `/dashboard?tab=agent` workspace + "Ask a4ai" sheet, Hindi-first, 360px, dark mode. Visible only when the agent backend answers (`VITE_AGENT_URL`); otherwise hidden | none without the agent backend |
| Voice UI | mic, push-to-talk, consent screen, settings; 1.5: streamed answer audio (gapless), barge-in (talk over the answer or tap), adaptive end of speech (short replies send in ~1 s) | none: the mic shows only when `GET /agent/voice/config` says enabled |

Not applied by this PR: `supabase/migrations/32_quota_reserve_voice_allowance.sql` (atomic quota + per-plan voice allowance; every plan's `voice_monthly_limit` is a TODO). Apply it when you decide the numbers; the backend works without it.

## Tests

vitest 436 passed (41 files). `tsc`: 40 errors, identical to `main` (none in agent/voice code). Playwright agent mock suite unchanged.

## Deploy order

1. Merge + deploy this PR.
2. Then the backend PR (`RAG-BACKEND` `claude/youthful-archimedes-tw0p0s`), with its Vercel env changes.

## Rollback

Redeploy the previous Vercel deployment; no migration is applied.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
