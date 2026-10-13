# Supabase key rotation — legacy JWT keys → publishable / secret keys

Why: the legacy `service_role` JWT has leaked. Rotating it means moving every consumer to the new API keys
(`sb_publishable_…` for browsers, `sb_secret_…` for servers) and then **disabling the legacy JWT keys**, which
makes the leaked key useless. Written 13 Oct 2026 from a read-only inventory of both repos and the live DB.

## Where Supabase keys are used today

| Consumer | Today | After |
|---|---|---|
| Frontend (Vercel `a4ai`) — `src/lib/supabaseClient.ts`, `src/lib/supabasePortalClient.ts`, `src/integrations/supabase/client.ts` | `VITE_SUPABASE_ANON_KEY` (legacy anon JWT) | `VITE_SUPABASE_PUBLISHABLE_KEY` (read first; anon is the fallback) |
| Backend (Vercel `rag-backend`) — `app/core/config.py`, `app/core/database.py`, `module_service.py` | `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` (+ `SUPABASE_ANON_KEY` fallback) | `SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY` (read first; legacy names are the fallback) |
| Edge Functions `generate-test`, `submit-contact`, `send-whatsapp-otp` | auto-injected `SUPABASE_SERVICE_ROLE_KEY` | `_shared/supabaseKeys.ts`: injected `SUPABASE_SECRET_KEYS`, else legacy |
| `scripts/attach_email_to_user.mjs` (product) | `$env:SUPABASE_SERVICE_ROLE_KEY` = legacy JWT | same variable, value = `sb_secret_…` |
| Backend local scripts (`ncert-ingestion/*`, `02_extract_ncert_questions.py`) | `SUPABASE_SERVICE_KEY` in local env | `sb_secret_…` value (needs supabase-py ≥ 2.16 locally) |
| `a4ai-api` (payments, api.a4ai.in) | no Supabase key | — |
| Database (cron, DB webhooks, vault, functions) | none found (no pg_cron, no hooks, vault empty, no JWT in function bodies) | — |
| Send SMS hook secret | own secret, not an API key | rotate separately |

Library support (checked 13 Oct):
- **supabase-py 2.9.0 rejects any non-JWT key** ("Invalid API key"). Branch `chore/supabase-new-keys` (RAG-BACKEND)
  pins **2.16.0** (commit 1b4b2c5; 2.32.0 needed a newer pydantic than the pinned 2.8.2 and broke the Vercel build).
  2.16.0 has no JWT check, so `sb_secret_…` / `sb_publishable_…` are accepted.
- supabase-js 2.52 (frontend, scripts) and 2.45.4 (Edge Functions) take any key string; they also send it as
  `Authorization: Bearer <key>` when there is no session. **Verify on step 4 / 5 below that requests with the new
  keys succeed before disabling legacy** — if they don't, bump `@supabase/supabase-js` (latest 2.117.x).

## Order (each step reversible until step 9)

**Code first — still on legacy keys, nothing changes for users**
1. RAG-BACKEND: merge `chore/supabase-new-keys` → `main` → prod Ready → `/health` 200, generate one test paper,
   one chat question, Check Copies. *Rollback: revert the merge.*
2. Product: merge `feat/smart-checker-v2` into `main` first (it has the WhatsApp kill switch in `send-whatsapp-otp`),
   then `chore/supabase-new-keys`. Deploy the frontend, then from `main`:
   `supabase functions deploy generate-test submit-contact send-whatsapp-otp`.
   Test: contact form (submit-contact), login. *Rollback: revert; redeploy the functions from the previous main.*

**Cutover — new keys alongside legacy**
3. Supabase Dashboard → Project Settings → **API Keys** → create a **publishable** key and a **secret** key
   (name it e.g. `backend`). Copy them straight into Vercel — not into chat or files.
4. Vercel `a4ai` → add `VITE_SUPABASE_PUBLISHABLE_KEY` (Production + Preview + Development) → Redeploy production.
   Test: email login, Google login, teacher dashboard, HOD page, student portal (incognito, access code), careers form.
5. Vercel `rag-backend` → add `SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY` (Production) → Redeploy.
   Startup refuses swapped keys (publishable as secret / secret as anon). Test: `/health`, test generation,
   chat, Check Copies, portal AI check, payment checkout.
6. Edge Functions need nothing — Supabase injects `SUPABASE_SECRET_KEYS`. Test contact form again.
7. Local: terminal only — `$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_…"` → `node scripts/attach_email_to_user.mjs … ` (dry run).
   Backend local env: put the new values in the local backend env (it currently has SUPABASE_SERVICE_KEY == anon).
8. Wait ~24 h. Watch Vercel + Supabase logs for 401 / "Invalid API key" / "Legacy API keys are disabled".

**Point of no return for the leak**
9. Supabase Dashboard → API Keys → **Legacy API keys → Disable**. The leaked service_role JWT stops working.
   What breaks if something was missed: any client still sending the legacy anon/service JWT — an old browser tab
   or a cached copy of the old bundle (fixed by reload), an Edge Function deployed before step 2, a local script
   with the old key. *Rollback: re-enable legacy keys in the same screen (code still falls back to them).*
10. Clean up: delete `VITE_SUPABASE_ANON_KEY` (a4ai) and `SUPABASE_KEY` / `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY`
    (rag-backend) from Vercel, redeploy both.

Optional, later: move auth to asymmetric JWT signing keys (Dashboard → JWT Keys). Revoking the old JWT secret
signs every user out — plan it for a quiet hour.
