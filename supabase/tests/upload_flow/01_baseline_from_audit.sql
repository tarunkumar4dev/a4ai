-- GENERATED from supabase/audit_2026-09-29.csv (live schema, 29 Sep 2026) by a one-off script.
-- Test harness only: the 19 audited tables as they were BEFORE migrations 05+ (those add columns).
-- Not a migration. id columns get gen_random_uuid() defaults and are primary keys.

CREATE TABLE public.institutes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text,
  logo_url text,
  owner_id uuid NOT NULL,
  plan_id text,
  max_teachers integer,
  max_students integer,
  monthly_test_limit integer,
  join_code text,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  name text NOT NULL,
  student_code text,
  teacher_code text,
  created_at timestamp with time zone DEFAULT now(),
  hod_id uuid,
  code text,
  is_active boolean,
  updated_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

CREATE TABLE public.sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL,
  name text NOT NULL,
  year integer,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE
);

CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  class_level text,
  subject text,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  section_id uuid,
  proctor_id uuid,
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL
);

CREATE TABLE public.institute_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text,
  invited_at timestamp with time zone,
  joined_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  section_id uuid,
  user_email text,
  user_name text,
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL
);

CREATE TABLE public.proctor_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  section_id uuid NOT NULL,
  department_id uuid NOT NULL,
  is_active boolean,
  assigned_at timestamp with time zone,
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES public.institute_members(id) ON DELETE CASCADE
);

CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  department_id uuid,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

CREATE TABLE public.teaching_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE
);

CREATE TABLE public.timetable_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  room text,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE
);

CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  batch_id uuid,
  name text NOT NULL,
  roll_no text,
  class_level text,
  parent_name text,
  parent_phone text,
  email text,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  section_id uuid,
  user_id uuid,
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.student_access_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  access_code character varying NOT NULL,
  batch_id uuid,
  institute_id uuid NOT NULL,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

CREATE TABLE public.class_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  timetable_slot_id uuid,
  batch_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  session_date date NOT NULL,
  status text NOT NULL,
  topic text,
  marked_by uuid,
  marked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (timetable_slot_id) REFERENCES public.timetable_slots(id) ON DELETE SET NULL
);

CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status text NOT NULL,
  marked_by uuid NOT NULL,
  marked_at timestamp with time zone NOT NULL,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

CREATE TABLE public.attendance_edit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  edited_by uuid NOT NULL,
  edited_at timestamp with time zone NOT NULL,
  reason text,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  deadline timestamp with time zone,
  file_url text,
  file_name character varying,
  status character varying,
  max_marks integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  file_url text,
  file_name character varying,
  text_answer text,
  submitted_at timestamp with time zone,
  grade integer,
  feedback text,
  graded_at timestamp with time zone,
  graded_by uuid,
  status character varying,
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title character varying NOT NULL,
  content text,
  file_url text,
  is_pinned boolean,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  batch_id uuid,
  created_by uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  event_type character varying,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  all_day boolean,
  meeting_link text,
  color character varying,
  is_recurring boolean,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

CREATE TABLE public.teacher_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  institute_id uuid NOT NULL,
  assigned_at timestamp with time zone,
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

-- RLS as on live (audit rls_enabled rows)
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_edit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
-- legacy check constraints that live had before 18 (definitions as on production; the submissions one was
-- dropped by hand on 23 Oct and by 22 — exact old value list reconstructed from the pre-18 code: submitted / graded)
ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_check
  CHECK (((status)::text = ANY ((ARRAY['submitted'::character varying, 'graded'::character varying, 'late'::character varying])::text[])));
ALTER TABLE public.assignments ADD CONSTRAINT assignments_status_check
  CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'draft'::character varying])::text[])));
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_batches ENABLE ROW LEVEL SECURITY;
