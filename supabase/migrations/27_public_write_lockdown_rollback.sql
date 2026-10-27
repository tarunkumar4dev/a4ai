-- Rollback for 27_public_write_lockdown.sql — restores the previous (open) policies and grants.
-- Only use if something that legitimately writes these tables with a non-service key breaks.
begin;

grant insert, update, delete on public.ncert_questions to anon, authenticated;
create policy "ncert_questions_insert_service" on public.ncert_questions
  for insert with check (true);

grant insert, update, delete on public.ncert_chunks to anon, authenticated;
create policy "Allow authenticated insert" on public.ncert_chunks
  for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.ncert_chunks
  for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on public.ncert_chunks
  for delete using (auth.role() = 'authenticated');

grant select on public.attendance_legacy to anon;
create policy "Public read attendance" on public.attendance_legacy
  for select using (true);

commit;
