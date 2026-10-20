-- demo_parent_phones.sql — parent WhatsApp number for the first 3 MSIT ECE-2 students (demo, 20 Oct 2026)
-- Not a migration. Replace 9XXXXXXXXX with your own 10-digit number (all 3 can be the same number),
-- then run in the Supabase SQL editor. Stored format = "+91" + 10 digits (same as the profile field saves).
--
-- Students (ECE-2, by roll no): Mohd Sameer Hussain · Khateeb Ahmad Khan · Prachi Shukla

begin;

update public.students s
   set parent_phone = '+91' || '9XXXXXXXXX'          -- ← your number here
 where s.id in (
   select st.id
     from public.students st
     join public.batches b on b.id = st.batch_id
    where st.institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
      and b.name = 'ECE-2'
      and st.is_active
    order by st.roll_no
    limit 3
 );

-- expect 3 rows
select name, roll_no, parent_phone
  from public.students
 where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885' and parent_phone is not null
 order by roll_no;

commit;

-- UNDO
-- update public.students set parent_phone = null
--  where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885' and parent_phone = '+919XXXXXXXXX';
