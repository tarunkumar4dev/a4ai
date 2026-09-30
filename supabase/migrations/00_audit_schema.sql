-- 00_audit_schema.sql  —  READ-ONLY. Kuch change nahi karta.
-- Supabase SQL editor me run karo → result ko "Download CSV" karke bhejo (ya Claude Code ko Supabase MCP se chalane do).
-- Isse pata chalega: har table ke columns, existing RLS policies, FKs aur saare RPC functions (security definer ya nahi).

with t(name) as (values
  ('institutes'),('institute_members'),('departments'),('sections'),('batches'),('students'),
  ('student_access_codes'),('subjects'),('teaching_assignments'),('teacher_batches'),
  ('proctor_assignments'),('timetable_slots'),('class_sessions'),('attendance_records'),
  ('attendance_edit_log'),('assignments'),('submissions'),('announcements'),
  ('batch_messages'),('calendar_events'),('attendance')
)
select 1 as ord, 'column' as kind, c.table_name as obj,
       string_agg(c.column_name || ' ' || c.data_type || case when c.is_nullable='NO' then ' NOT NULL' else '' end, ', ' order by c.ordinal_position) as detail
from information_schema.columns c join t on t.name = c.table_name
where c.table_schema = 'public'
group by c.table_name

union all
select 2, 'rls_enabled', c.relname, case when c.relrowsecurity then 'RLS ON' else 'RLS OFF' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace join t on t.name = c.relname
where n.nspname = 'public'

union all
select 3, 'policy', p.tablename,
       p.policyname || ' | ' || p.cmd || ' | roles=' || array_to_string(p.roles, ',') ||
       ' | USING: ' || coalesce(p.qual, '-') || ' | CHECK: ' || coalesce(p.with_check, '-')
from pg_policies p join t on t.name = p.tablename
where p.schemaname = 'public'

union all
select 4, 'fk', tc.table_name,
       kcu.column_name || ' -> ' || ccu.table_name || '.' || ccu.column_name || ' (on delete ' || rc.delete_rule || ')'
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
join t on t.name = tc.table_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'

union all
select 5, 'function', p.proname,
       pg_get_function_identity_arguments(p.oid) || case when p.prosecdef then '  [SECURITY DEFINER]' else '  [invoker]' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname !~ '^(pg_|vector|halfvec|sparsevec|l2_|cosine_|inner_product|ivfflat|hnsw|array_to_)'

order by 1, 3, 4;
