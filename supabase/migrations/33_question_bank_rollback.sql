-- 33_question_bank_rollback.sql — removes everything 33_question_bank.sql created.
-- DELETES every saved question bank. Papers already built from a bank stay in tests / questions (Test History).

begin;

drop table if exists public.bank_questions;
drop table if exists public.question_banks;
drop function if exists public.a4_qb_my_institute_ids();

commit;
