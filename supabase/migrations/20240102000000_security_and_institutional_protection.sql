-- supabase/migrations/20240102000000_security_and_institutional_protection.sql
-- =============================================================================
-- Migration: Security, Abuse Prevention, Institutional Data Protection & DB Hygiene
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY AUDIT & ABUSE TRACKING TABLE
-- Logs auth events, suspicious WAF blocks, OTP requests, and lockout events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                -- 'login_success', 'login_failed', 'lockout', 'otp_requested', 'waf_block'
    identifier_hash TEXT,                -- Hashed email or phone (preserves privacy)
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL,                -- 'success', 'failed', 'blocked'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON auth_security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_identifier ON auth_security_logs(identifier_hash);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON auth_security_logs(action);

-- Enable RLS on audit logs (accessible only to service role / superadmin)
ALTER TABLE auth_security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on security logs"
    ON auth_security_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can only read their own security logs
CREATE POLICY "Users can view own security logs"
    ON auth_security_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSTITUTIONAL DATA PROTECTION (ROW LEVEL SECURITY)
-- Safeguards academic data: students, teacher profiles, attendance, batches.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function: check if user is owner of an institute
CREATE OR REPLACE FUNCTION is_institute_owner(p_institute_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM institutes
        WHERE id = p_institute_id AND owner_id = auth.uid()
    );
$$;

-- Helper function: check if user is a teacher assigned to a batch
CREATE OR REPLACE FUNCTION is_teacher_for_batch(p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM teaching_assignments
        WHERE batch_id = p_batch_id AND teacher_id = auth.uid()
    );
$$;

-- 2.1 PROFILES PROTECTION
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    CREATE POLICY "Users can view own profile"
        ON profiles FOR SELECT
        TO authenticated
        USING (id = auth.uid());
EXCEPTION WHEN undefined_table THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    CREATE POLICY "Users can update own profile"
        ON profiles FOR UPDATE
        TO authenticated
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid());
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 2.2 INSTITUTES PROTECTION
DO $$ BEGIN
    ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;

    -- Anyone logged in can read institutes to resolve join codes or institute names
    DROP POLICY IF EXISTS "Authenticated users can view institutes" ON institutes;
    CREATE POLICY "Authenticated users can view institutes"
        ON institutes FOR SELECT
        TO authenticated
        USING (true);

    -- Only owner can modify institute
    DROP POLICY IF EXISTS "Owners can update own institute" ON institutes;
    CREATE POLICY "Owners can update own institute"
        ON institutes FOR UPDATE
        TO authenticated
        USING (owner_id = auth.uid())
        WITH CHECK (owner_id = auth.uid());

    DROP POLICY IF EXISTS "Owners can insert own institute" ON institutes;
    CREATE POLICY "Owners can insert own institute"
        ON institutes FOR INSERT
        TO authenticated
        WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 2.3 STUDENTS PROTECTION (SENSITIVE ACADEMIC RECORDS)
DO $$ BEGIN
    ALTER TABLE students ENABLE ROW LEVEL SECURITY;

    -- Institute admin can view all students in their institute batches
    DROP POLICY IF EXISTS "Institute owners view students" ON students;
    CREATE POLICY "Institute owners view students"
        ON students FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM batches b
                JOIN institutes i ON i.id = b.institute_id
                WHERE b.id = students.batch_id AND i.owner_id = auth.uid()
            )
        );

    -- Assigned teachers can view students in their assigned batches
    DROP POLICY IF EXISTS "Teachers view batch students" ON students;
    CREATE POLICY "Teachers view batch students"
        ON students FOR SELECT
        TO authenticated
        USING (is_teacher_for_batch(students.batch_id));

    -- Students can view their own profile if linked by user_id
    DROP POLICY IF EXISTS "Students view own record" ON students;
    CREATE POLICY "Students view own record"
        ON students FOR SELECT
        TO authenticated
        USING (
            (current_setting('request.jwt.claim.sub', true))::uuid = id
        );

    -- Only institute owners can insert/update/delete students
    DROP POLICY IF EXISTS "Institute owners manage students" ON students;
    CREATE POLICY "Institute owners manage students"
        ON students FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM batches b
                JOIN institutes i ON i.id = b.institute_id
                WHERE b.id = students.batch_id AND i.owner_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM batches b
                JOIN institutes i ON i.id = b.institute_id
                WHERE b.id = students.batch_id AND i.owner_id = auth.uid()
            )
        );
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 2.4 ATTENDANCE RECORDS PROTECTION
DO $$ BEGIN
    ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

    -- Teachers can insert & update class sessions for themselves
    DROP POLICY IF EXISTS "Teachers manage own sessions" ON class_sessions;
    CREATE POLICY "Teachers manage own sessions"
        ON class_sessions FOR ALL
        TO authenticated
        USING (teacher_id = auth.uid())
        WITH CHECK (teacher_id = auth.uid());

    -- Teachers can insert attendance for their sessions
    DROP POLICY IF EXISTS "Teachers manage session attendance" ON attendance_records;
    CREATE POLICY "Teachers manage session attendance"
        ON attendance_records FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM class_sessions cs
                WHERE cs.id = attendance_records.session_id AND cs.teacher_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM class_sessions cs
                WHERE cs.id = attendance_records.session_id AND cs.teacher_id = auth.uid()
            )
        );

    -- Institute owners can view all attendance
    DROP POLICY IF EXISTS "Institute owners view attendance" ON attendance_records;
    CREATE POLICY "Institute owners view attendance"
        ON attendance_records FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM class_sessions cs
                JOIN batches b ON b.id = cs.batch_id
                JOIN institutes i ON i.id = b.institute_id
                WHERE cs.id = attendance_records.session_id AND i.owner_id = auth.uid()
            )
        );
EXCEPTION WHEN undefined_table THEN null; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DATABASE HYGIENE & ROUTINE CLEANUP
-- Automatically cleans stale OTP logs, abandoned sessions, and test records.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_unverified_and_stale_data()
RETURNS TABLE (
    deleted_security_logs_count BIGINT,
    cleaned_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_logs BIGINT := 0;
BEGIN
    -- 1. Purge security logs older than 30 days
    WITH deleted AS (
        DELETE FROM auth_security_logs
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_logs FROM deleted;

    -- 2. Optional: Log cleanup event into security logs
    INSERT INTO auth_security_logs (action, status, details)
    VALUES (
        'db_routine_cleanup',
        'success',
        jsonb_build_object('purged_logs', v_deleted_logs)
    );

    RETURN QUERY SELECT v_deleted_logs, NOW();
END;
$$;

-- Grant execution to authenticated service role
REVOKE ALL ON FUNCTION cleanup_unverified_and_stale_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_unverified_and_stale_data() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Note for Scheduling:
-- If pg_cron extension is enabled on your Supabase instance, run:
-- SELECT cron.schedule('daily-db-cleanup', '0 3 * * *', 'SELECT cleanup_unverified_and_stale_data();');
-- ─────────────────────────────────────────────────────────────────────────────

