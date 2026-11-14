-- supabase/demo_parent_phones.sql
-- Demo seed for "Notify Parents via WhatsApp". NOT a migration: no schema change, and it is never
-- applied automatically. Run it by hand in the Supabase SQL editor before a demo.
--
-- Fills the parent contact for the first 3 students of MSIT ECE-2
-- (institute 6563b6a1-6062-4e00-a9fe-3cf7ae77a885, batch 6803fe2a-3591-444c-910d-7b95415bf207).
--
-- ▸ REPLACE +91XXXXXXXXXX WITH YOUR OWN NUMBER IN ALL 3 ROWS, THEN RUN.
--   The number must be a real 10-digit Indian mobile (starting 6-9) or the wa.me link will be dead.
--   parent_phone is stored in E.164 ("+91XXXXXXXXXX"); the app strips the "+" for wa.me.

UPDATE students SET
  parent_name  = 'Parent of ' || name,
  parent_phone = '+91XXXXXXXXXX'   -- <-- your number
WHERE id = '2b6669f6-aff0-4d90-a3f4-91fd1b681db1';

UPDATE students SET
  parent_name  = 'Parent of ' || name,
  parent_phone = '+91XXXXXXXXXX'   -- <-- your number
WHERE id = '25912939-aa13-43e9-8e3d-42d2b74db506';

UPDATE students SET
  parent_name  = 'Parent of ' || name,
  parent_phone = '+91XXXXXXXXXX'   -- <-- your number
WHERE id = 'f3923a34-d963-4f0e-8356-5622e47286dc';

-- Check (masked, so the sheet can be shown on a screen):
--   SELECT name, parent_name, '••••' || right(parent_phone, 4) AS parent_phone
--   FROM students
--   WHERE id IN ('2b6669f6-aff0-4d90-a3f4-91fd1b681db1',
--                '25912939-aa13-43e9-8e3d-42d2b74db506',
--                'f3923a34-d963-4f0e-8356-5622e47286dc');

-- Undo after the demo:
--   UPDATE students SET parent_name = NULL, parent_phone = NULL
--   WHERE id IN ('2b6669f6-aff0-4d90-a3f4-91fd1b681db1',
--                '25912939-aa13-43e9-8e3d-42d2b74db506',
--                'f3923a34-d963-4f0e-8356-5622e47286dc');
