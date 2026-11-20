-- 34_roster_from_student_batches_rollback.sql — undo 34: restores the LIVE definitions of 20 Nov 2026
-- (copied verbatim from pg_get_functiondef, read-only dump) and drops the helper.
-- Grants are kept by CREATE OR REPLACE. After rollback, attendance again reads only students.batch_id.

begin;

CREATE OR REPLACE FUNCTION public.a4_my_teaching_batch_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ta.batch_id from teaching_assignments ta where ta.teacher_id = auth.uid() and coalesce(ta.is_active, true)
  union
  select ts.batch_id from timetable_slots ts where ts.teacher_id = auth.uid() and coalesce(ts.is_active, true);
  -- NOTE: legacy teacher_batches jaan-bujh ke include NAHI kiya — wahi "sab dikh raha hai" wala purana rasta tha.
$function$;

CREATE OR REPLACE FUNCTION public.get_class_roster(p_batch_id uuid, p_subject_id uuid, p_date date, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(session_id uuid, student_id uuid, student_name text, roll_no text, status text, marked_by_name text, marked_at timestamp with time zone, month_held integer, month_present integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_b    batches%ROWTYPE;
  v_role TEXT;
  v_sid  UUID;
  v_from DATE := date_trunc('month', p_date)::DATE;
  v_to   DATE := (date_trunc('month', p_date) + INTERVAL '1 month')::DATE;
BEGIN
  SELECT * INTO v_b FROM batches WHERE id = p_batch_id;
  IF v_b.id IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;

  v_role := att_caller_role(v_b.institute_id);
  IF v_role IS NULL THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF NOT (
       v_role = 'admin'
    OR (v_b.section_id IS NOT NULL AND att_can_view_section(v_b.section_id))
    OR EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.batch_id = p_batch_id AND ta.subject_id = p_subject_id
                 AND ta.teacher_id = auth.uid() AND ta.is_active)
    OR EXISTS (SELECT 1 FROM timetable_slots ts WHERE ts.batch_id = p_batch_id AND ts.subject_id = p_subject_id
                 AND ts.teacher_id = auth.uid() AND ts.is_active)
  ) THEN RAISE EXCEPTION 'Permission denied'; END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT cs.id INTO v_sid FROM class_sessions cs
     WHERE cs.id = p_session_id AND cs.batch_id = p_batch_id AND cs.subject_id = p_subject_id;
  END IF;
  IF v_sid IS NULL THEN
    SELECT cs.id INTO v_sid FROM class_sessions cs
     WHERE cs.batch_id = p_batch_id AND cs.subject_id = p_subject_id AND cs.session_date = p_date
       AND COALESCE(cs.status, '') <> 'cancelled'
     ORDER BY EXISTS (SELECT 1 FROM attendance_records r WHERE r.session_id = cs.id) DESC, cs.created_at
     LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT v_sid, st.id, st.name::TEXT, st.roll_no::TEXT,
         ar.status::TEXT,
         CASE WHEN ar.marked_by IS NULL THEN NULL ELSE att_user_name(ar.marked_by) END,
         ar.marked_at,
         COALESCE(m.held, 0), COALESCE(m.present, 0)
    FROM students st
    LEFT JOIN attendance_records ar ON ar.session_id = v_sid AND ar.student_id = st.id
    LEFT JOIN LATERAL (
      SELECT count(*)::INT AS held,
             count(*) FILTER (WHERE r.status = 'present')::INT AS present
        FROM attendance_records r
        JOIN class_sessions c ON c.id = r.session_id
       WHERE r.student_id = st.id AND c.batch_id = p_batch_id AND c.subject_id = p_subject_id
         AND c.session_date >= v_from AND c.session_date < v_to
         AND COALESCE(c.status, '') <> 'cancelled'
    ) m ON true
   WHERE st.batch_id = p_batch_id AND COALESCE(st.is_active, true)
   ORDER BY st.roll_no, st.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_class_attendance(p_institute_id uuid, p_batch_id uuid, p_subject_id uuid, p_date date, p_timetable_slot_id uuid, p_session_id uuid, p_records jsonb, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT := att_caller_role(p_institute_id);
  v_batch   batches%ROWTYPE;
  v_kind    TEXT;
  v_win     INT;
  v_sid     UUID;
  v_teacher UUID;
  v_today   DATE := att_today_ist();
  v_trigger BOOLEAN;
  v_changed INT := 0;
  v_reason  TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id AND institute_id = p_institute_id;
  IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;

  -- who is saving? (most powerful role wins)
  IF v_role = 'admin' THEN
    v_kind := 'admin';
  ELSIF v_batch.section_id IS NOT NULL AND att_is_section_proctor(v_batch.section_id) THEN
    v_kind := 'proctor';
  ELSIF v_role = 'hod' AND EXISTS (SELECT 1 FROM institute_members WHERE user_id = v_uid AND role = 'hod'
          AND status = 'active' AND department_id = v_batch.department_id) THEN
    v_kind := 'hod';
  ELSIF EXISTS (SELECT 1 FROM teaching_assignments WHERE batch_id = p_batch_id AND subject_id = p_subject_id
                  AND teacher_id = v_uid AND is_active)
     OR EXISTS (SELECT 1 FROM timetable_slots WHERE batch_id = p_batch_id AND subject_id = p_subject_id
                  AND teacher_id = v_uid AND is_active) THEN
    v_kind := 'teacher';
  ELSE
    RAISE EXCEPTION 'You are not assigned to this class';
  END IF;

  IF p_date > v_today THEN RAISE EXCEPTION 'Cannot mark attendance for a future date'; END IF;
  v_win := att_edit_window_days(v_kind);
  IF v_win IS NOT NULL AND p_date < v_today - v_win THEN
    RAISE EXCEPTION 'Edit window closed (% days). %', v_win,
      CASE WHEN v_kind = 'teacher' THEN 'Ask your class teacher (proctor).' ELSE 'Ask your HOD or admin.' END;
  END IF;

  -- find the session
  IF p_session_id IS NOT NULL THEN
    SELECT id INTO v_sid FROM class_sessions
     WHERE id = p_session_id AND batch_id = p_batch_id AND subject_id = p_subject_id;
  END IF;
  IF v_sid IS NULL AND p_timetable_slot_id IS NOT NULL THEN
    SELECT id INTO v_sid FROM class_sessions
     WHERE timetable_slot_id = p_timetable_slot_id AND session_date = p_date;
  END IF;
  IF v_sid IS NULL THEN
    SELECT id INTO v_sid FROM class_sessions
     WHERE batch_id = p_batch_id AND subject_id = p_subject_id AND session_date = p_date
       AND COALESCE(status, '') <> 'cancelled'
     ORDER BY (teacher_id = v_uid) DESC NULLS LAST, created_at
     LIMIT 1;
  END IF;

  IF v_sid IS NULL THEN
    -- class belongs to the subject teacher even if the proctor marks it
    v_teacher := COALESCE(
      (SELECT teacher_id FROM timetable_slots WHERE id = p_timetable_slot_id),
      (SELECT teacher_id FROM teaching_assignments
        WHERE batch_id = p_batch_id AND subject_id = p_subject_id AND is_active
        ORDER BY (teacher_id = v_uid) DESC, created_at LIMIT 1),
      v_uid);
    INSERT INTO class_sessions (institute_id, timetable_slot_id, batch_id, subject_id, teacher_id,
                                session_date, status, marked_by, marked_at, created_at)
    VALUES (p_institute_id, p_timetable_slot_id, p_batch_id, p_subject_id, v_teacher,
            p_date, 'conducted', v_uid, now(), now())
    RETURNING id INTO v_sid;
  ELSE
    UPDATE class_sessions SET status = 'conducted', marked_by = v_uid, marked_at = now() WHERE id = v_sid;
  END IF;

  -- incoming marks (only students of this batch, only valid statuses)
  CREATE TEMP TABLE IF NOT EXISTS _att_in (student_id UUID PRIMARY KEY, status TEXT) ON COMMIT DROP;
  TRUNCATE pg_temp._att_in;
  INSERT INTO pg_temp._att_in (student_id, status)
  SELECT DISTINCT ON (x.student_id) x.student_id, x.status
    FROM jsonb_to_recordset(p_records) AS x(student_id UUID, status TEXT)
    JOIN students st ON st.id = x.student_id AND st.batch_id = p_batch_id
   WHERE x.status IN ('present', 'absent', 'leave');

  -- audit: is there already a trigger on attendance_records that writes attendance_edit_log?
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.attendance_records'::regclass AND NOT t.tgisinternal
       AND p.prosrc ILIKE '%attendance_edit_log%'
  ) INTO v_trigger;

  IF NOT v_trigger THEN
    INSERT INTO attendance_edit_log (institute_id, session_id, student_id, old_status, new_status,
                                     edited_by, edited_at, reason)
    SELECT p_institute_id, v_sid, i.student_id, ar.status, i.status, v_uid, now(), v_reason
      FROM pg_temp._att_in i
      JOIN attendance_records ar ON ar.session_id = v_sid AND ar.student_id = i.student_id
     WHERE ar.status IS DISTINCT FROM i.status;
  END IF;

  -- changed marks
  UPDATE attendance_records ar
     SET status = i.status, marked_by = v_uid, marked_at = now()
    FROM pg_temp._att_in i
   WHERE ar.session_id = v_sid AND ar.student_id = i.student_id
     AND ar.status IS DISTINCT FROM i.status;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- existing trigger logged the change → attach the reason to those rows
  IF v_trigger AND v_changed > 0 AND v_reason IS NOT NULL THEN
    BEGIN
      UPDATE attendance_edit_log SET reason = v_reason
       WHERE session_id = v_sid AND reason IS NULL AND edited_at >= now();
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  -- new marks
  INSERT INTO attendance_records (institute_id, session_id, student_id, status, marked_by, marked_at)
  SELECT p_institute_id, v_sid, i.student_id, i.status, v_uid, now()
    FROM pg_temp._att_in i
  ON CONFLICT (session_id, student_id) DO NOTHING;

  RETURN v_sid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_teaching_targets(p_institute_id uuid)
 RETURNS TABLE(batch_id uuid, batch_name text, section_id uuid, section_name text, subject_id uuid, subject_name text, subject_code text, is_mine boolean, student_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT := att_caller_role(p_institute_id);
  v_full BOOLEAN;
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'Permission denied'; END IF;
  -- to_jsonb() so this works even if the hierarchy_mode column was never added
  SELECT COALESCE(to_jsonb(i)->>'hierarchy_mode', 'simple') = 'full' INTO v_full FROM institutes i WHERE i.id = p_institute_id;
  v_full := COALESCE(v_full, false);

  RETURN QUERY
  WITH pairs AS (
    SELECT ta.batch_id, ta.subject_id, ta.teacher_id FROM teaching_assignments ta
     WHERE ta.institute_id = p_institute_id AND ta.is_active
    UNION
    SELECT ts.batch_id, ts.subject_id, ts.teacher_id FROM timetable_slots ts
     WHERE ts.institute_id = p_institute_id AND ts.is_active
  ),
  hod_depts AS (
    SELECT im.department_id FROM institute_members im
     WHERE im.user_id = auth.uid() AND im.role = 'hod' AND im.status = 'active'
  ),
  scoped AS (
    SELECT p.batch_id, p.subject_id, bool_or(p.teacher_id = auth.uid()) AS mine
      FROM pairs p JOIN batches b ON b.id = p.batch_id
     WHERE COALESCE(b.is_active, true)
       AND (NOT v_full OR b.section_id IS NOT NULL)
       AND (
         p.teacher_id = auth.uid()
         OR v_role = 'admin'
         OR (v_role = 'hod' AND b.department_id IN (SELECT department_id FROM hod_depts))
       )
     GROUP BY p.batch_id, p.subject_id
  )
  SELECT b.id, b.name::TEXT, b.section_id, sec.name::TEXT,
         sub.id, sub.name::TEXT, sub.code::TEXT,
         sc.mine,
         (SELECT count(*)::INT FROM students st WHERE st.batch_id = b.id AND COALESCE(st.is_active, true))
    FROM scoped sc
    JOIN batches b    ON b.id = sc.batch_id
    JOIN subjects sub ON sub.id = sc.subject_id
    LEFT JOIN sections sec ON sec.id = b.section_id
   ORDER BY sc.mine DESC, sec.name NULLS LAST, b.name, sub.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_teacher_day_sessions(p_institute_id uuid, p_date date)
 RETURNS TABLE(session_id uuid, timetable_slot_id uuid, batch_id uuid, batch_name text, section_name text, subject_id uuid, subject_name text, subject_code text, start_time time without time zone, room text, student_count integer, is_marked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF att_caller_role(p_institute_id) IS NULL THEN RAISE EXCEPTION 'Permission denied'; END IF;

  IF p_date <= att_today_ist() THEN
    BEGIN
      PERFORM generate_daily_sessions(p_institute_id, p_date);
    EXCEPTION WHEN OTHERS THEN NULL;  -- non-fatal
    END;
  END IF;

  RETURN QUERY
  SELECT cs.id, cs.timetable_slot_id, b.id, b.name::TEXT, sec.name::TEXT,
         sub.id, sub.name::TEXT, sub.code::TEXT,
         ts.start_time, ts.room::TEXT,
         (SELECT count(*)::INT FROM students st WHERE st.batch_id = b.id AND COALESCE(st.is_active, true)),
         EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id = cs.id)
    FROM class_sessions cs
    JOIN batches b    ON b.id = cs.batch_id
    JOIN subjects sub ON sub.id = cs.subject_id
    LEFT JOIN sections sec ON sec.id = b.section_id
    LEFT JOIN timetable_slots ts ON ts.id = cs.timetable_slot_id
   WHERE cs.institute_id = p_institute_id
     AND cs.session_date = p_date
     AND cs.teacher_id = auth.uid()
     AND COALESCE(cs.status, '') <> 'cancelled'
   ORDER BY ts.start_time NULLS LAST, sub.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_attendance(p_batch_id uuid, p_month integer, p_year integer, p_subject_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, student_name text, roll_no text, subject_name text, subject_code text, total_held bigint, total_present bigint, total_absent bigint, total_late bigint, total_leave bigint, percentage numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.a4_can_view_batch(p_batch_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  return query
  select
    s.id as student_id,
    s.name as student_name,
    s.roll_no,
    sub.name as subject_name,
    sub.code as subject_code,
    count(ar.id) as total_held,
    count(ar.id) filter (where ar.status = 'present') as total_present,
    count(ar.id) filter (where ar.status = 'absent') as total_absent,
    count(ar.id) filter (where ar.status = 'late') as total_late,
    count(ar.id) filter (where ar.status = 'leave') as total_leave,
    case
      when count(ar.id) = 0 then 0.00
      else round(
        count(ar.id) filter (where ar.status in ('present', 'late'))::numeric
        / count(ar.id)::numeric * 100,
        2
      )
    end as percentage
  from students s
  cross join subjects sub
  left join class_sessions cs on cs.batch_id = p_batch_id
    and cs.subject_id = sub.id
    and cs.status = 'conducted'
    and extract(month from cs.session_date) = p_month
    and extract(year from cs.session_date) = p_year
  left join attendance_records ar on ar.session_id = cs.id
    and ar.student_id = s.id
  where s.batch_id = p_batch_id
    and s.is_active = true
    and sub.id = coalesce(p_subject_id, sub.id)
    and sub.department_id = (select department_id from batches where id = p_batch_id)
  group by s.id, s.name, s.roll_no, sub.name, sub.code
  order by s.roll_no, sub.code;
end;
$function$;

drop function if exists public.a4_batch_student_ids(uuid);

commit;

notify pgrst, 'reload schema';
