-- 06a_students_phone.sql — students.phone + students.gender.
-- Run BEFORE the Step 6 fresh run (bulk upload writes `phone` when the xlsx has a phone column).
-- Why: audit (29 Sep) shows neither column exists, but
--   * BulkStudentUpload now maps the student's own "phone" column to students.phone (was wrongly going to parent_phone)
--   * TeacherStudentsTab "Add student" already sends phone + gender → that insert fails without these columns
--   * StudentProfilePage uses gender for the avatar and shows phone
-- Safe to re-run.

begin;

alter table public.students
  add column if not exists phone  text,
  add column if not exists gender text;

commit;

-- TEST:
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'students' and column_name in ('phone', 'gender');   -- 2 rows
