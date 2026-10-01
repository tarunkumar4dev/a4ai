# Rollout: AI chat proxy (Groq removal, OpenRouter via backend)

Also ships: `vercel.json` (missing `/assets/*` now return 404 instead of `index.html`, security
headers) and the one-time chunk reload in `src/main.tsx` (blank page after deploys).

## Before
- [ ] Run migration `supabase/migrations/20261001100000_ai_chat_usage.sql` in Supabase SQL Editor
      (additive) and its verification queries.
- [ ] Backend Vercel env: add `OPENROUTER_API_KEY` (new, rotated key); remove `GROQ_API_KEY`.
      Optional: `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS`, `AI_CHAT_DAILY_LIMIT`.
- [ ] Frontend Vercel env: remove `VITE_GROQ_API_KEY` and `VITE_OPENROUTER_API_KEY`;
      set `VITE_CHAT_BACKEND_ENABLED=true`.

## Step 1 — Backend deploy
- Deploy RAG-BACKEND. Wait ~30 s, then:
  - `curl https://rag-backend-kappa-three.vercel.app/health` -> 200
  - `curl -X POST https://rag-backend-kappa-three.vercel.app/api/v1/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}'`
    -> 401 (auth enforced)

## Step 2 — Frontend deploy (immediately after)
- Merge/deploy a4ai. Hard-refresh the site, open the Teacher dashboard chat, send a message.
- Verify: a reply arrives; DevTools Network shows `POST /api/v1/chat` with an `Authorization`
  header and no request to `api.groq.com` / `openrouter.ai`.
- Verify the frontend config changes:
  1. `curl -s -o /dev/null -w "%{http_code}\n" https://www.a4ai.in/assets/does-not-exist.js` -> 404
  2. Open `https://www.a4ai.in/dashboard/test-generator` directly and refresh -> page loads
  3. `curl -sI https://www.a4ai.in/` shows X-Frame-Options, X-Content-Type-Options,
     Referrer-Policy, Permissions-Policy (HSTS is already sent by Vercel)
  4. A proctored contest still gets camera access

## Step 3 — Monitor for 5 minutes
- Vercel backend logs: count of 401 / 429 / 503 on `/api/v1/chat`.
- Supabase: `select * from ai_chat_usage order by updated_at desc limit 20;` (counts growing)

## Step 4 — Rollback triggers and actions
- 401 spike from logged-in users: set `VITE_CHAT_BACKEND_ENABLED=false` in frontend Vercel env and
  redeploy (chat falls back to the offline helper; no keys are shipped). Then investigate `app/core/auth.py`.
- 503 spike (OpenRouter down / no credits): check `OPENROUTER_API_KEY` and the OpenRouter dashboard;
  switch `OPENROUTER_MODEL` if a single model is failing.
- Full revert: Vercel "Promote to Production" on the previous deployment of each project.
  The previous frontend build contains client-side LLM keys — only promote it back once those keys
  are revoked.
