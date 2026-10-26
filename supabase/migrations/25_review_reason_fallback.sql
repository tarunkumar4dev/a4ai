-- 25_review_reason_fallback.sql — checker P0 (backend fix/checker-p0, docs/audit/inventory.md §8)
--
-- 24 Oct: 10 of 23 Economics copies were marked by a backup model (gemini-3-flash-preview) and nobody was told.
-- A copy marked by a model other than the primary now carries the review reason 'fallback_model', so it lands in
-- needs_review and is never auto-published (a4_check_job_state_sync only auto-publishes copies without reasons).
--
-- Own file: a new enum value can't be used in the transaction that adds it. Nothing else here.
-- Rollback: none needed — an unused enum value is harmless (Postgres can't drop one without recreating the type).

alter type public.a4_review_reason add value if not exists 'fallback_model';
