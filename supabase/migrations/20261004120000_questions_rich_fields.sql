-- ════════════════════════════════════════════════════════════════════════════
-- Saved papers keep everything the generator produced (04 Oct 2026)
--
-- The generator returns question tables, CBSE internal-choice (OR) flags,
-- case-study sub-parts, marking schemes and model answers, but public.questions
-- had no columns for them, so a saved paper lost them (/save silently dropped
-- question_table on every insert). Re-downloading a paper from the dashboard
-- then printed OR alternatives as extra questions (wrong Maximum Marks) and
-- statistics/accountancy questions without their data tables.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Additive only: new nullable/defaulted columns, no existing data changes.
-- Safe in any order with the backend: /save retries without these fields if
-- the columns are missing.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.questions
  add column if not exists question_table  jsonb,
  add column if not exists is_or           boolean not null default false,
  add column if not exists sub_parts       jsonb,
  add column if not exists marking_scheme  jsonb,
  add column if not exists model_answer    text,
  add column if not exists common_mistakes jsonb;

-- VERIFY (expect 6 rows):
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'questions'
--   and column_name in ('question_table','is_or','sub_parts','marking_scheme','model_answer','common_mistakes');

-- ROLLBACK (drops only these columns and whatever was saved in them):
-- alter table public.questions
--   drop column if exists question_table, drop column if exists is_or, drop column if exists sub_parts,
--   drop column if exists marking_scheme, drop column if exists model_answer, drop column if exists common_mistakes;
