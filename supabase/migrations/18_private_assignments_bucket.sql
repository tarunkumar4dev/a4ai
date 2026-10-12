-- 18_private_assignments_bucket.sql — DRAFT (13 Oct 2026). Human reviews and runs it.
--
-- Before: the `assignments` bucket (question papers) was PUBLIC — anyone with a file URL could read it.
-- `submissions` went private in 13; students then had no way to reopen their own PDF.
--
-- Convention kept (same as submissions in 13): assignments.file_url / submissions.file_url keep the
-- ".../storage/v1/object/public/<bucket>/<path>" form. It is only a reference now — submit_assignment
-- checks '/submissions/<inst>/<asg>/<student>_' inside it and the backend AI check parses it — so NO
-- data conversion is needed. Live check 13 Oct: assignments 0 rows, submissions 0 rows, notes 0 rows
-- (orphan storage objects: assignments 15, submissions 6, notes 11 — no table rows point at them).
--
-- 1. a4_storage_path()                path inside a bucket from a stored public-format URL
-- 2. assignments bucket private        staff who can see the assignment's batch (or the uploader) may
--                                     read → teacher side uses signed URLs
-- 3. portal_assignment_files()        access code + assignment → the two paths the student may open;
--                                     service_role only (the backend signs 10-minute URLs)
-- 4. notes                            owner may delete their own file (the app already calls remove())
-- Safe to re-run.

begin;

-- ── 1. Path from a stored URL ────────────────────────────────────────────────
create or replace function public.a4_storage_path(p_url text, p_bucket text)
returns text language sql immutable set search_path = public as $$
  select nullif(split_part(split_part(coalesce(p_url, ''), '/storage/v1/object/public/' || p_bucket || '/', 2), '?', 1), '');
$$;

-- ── 2. Assignments bucket: private + scoped staff read ──────────────────────
create or replace function public.a4_can_read_assignment_object(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a
     where public.a4_storage_path(a.file_url, 'assignments') = p_name
       and (a.institute_id in (select public.a4_my_admin_inst_ids())
            or a.batch_id in (select public.a4_my_visible_batch_ids())));
$$;
revoke execute on function public.a4_can_read_assignment_object(text) from public, anon;
grant  execute on function public.a4_can_read_assignment_object(text) to authenticated, service_role;

update storage.buckets set public = false where id = 'assignments';

drop policy if exists a4_assignments_staff_read on storage.objects;
create policy a4_assignments_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'assignments'
         and (owner_id = auth.uid()::text                         -- the teacher who uploaded it
              or public.a4_can_read_assignment_object(name)));    -- staff who can see the batch

-- ── 3. Portal: which files may this access code open? ───────────────────────
create or replace function public.portal_assignment_files(p_code text, p_assignment_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := public.a4_student_id_from_code(p_code);
  st        record;
  a         record;
  v_sub     text;
begin
  if v_student is null then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;
  select id, institute_id, batch_id, lab_batch_id into st from students where id = v_student;

  select id, file_url into a
    from assignments
   where id = p_assignment_id and status = 'active'
     and institute_id = st.institute_id
     and batch_id in (st.batch_id, st.lab_batch_id);
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select file_url into v_sub from submissions where assignment_id = a.id and student_id = v_student;

  return json_build_object('ok', true,
                           'question_path',   public.a4_storage_path(a.file_url, 'assignments'),
                           'submission_path', public.a4_storage_path(v_sub, 'submissions'));
end $$;
revoke execute on function public.portal_assignment_files(text, uuid) from public, anon, authenticated;
grant  execute on function public.portal_assignment_files(text, uuid) to service_role;

-- ── 4. Notes: owner deletes own file ─────────────────────────────────────────
drop policy if exists a4_notes_delete_own on storage.objects;
create policy a4_notes_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and owner_id = auth.uid()::text);

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (read-only; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'assignments private', not (select public from storage.buckets where id = 'assignments')
-- union all select 'staff read policy', exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'a4_assignments_staff_read')
-- union all select 'portal fn service_role only', not has_function_privilege('anon', 'public.portal_assignment_files(text,uuid)', 'execute')
--                                              and not has_function_privilege('authenticated', 'public.portal_assignment_files(text,uuid)', 'execute')
-- union all select 'notes delete policy', exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'a4_notes_delete_own')
-- union all select 'path helper', public.a4_storage_path('https://x.supabase.co/storage/v1/object/public/assignments/i/1_a.pdf?t=1', 'assignments') = 'i/1_a.pdf';
--
-- ROLLBACK (if teachers/students can't open files):
--   update storage.buckets set public = true where id = 'assignments';
