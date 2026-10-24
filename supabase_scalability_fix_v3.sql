-- ============================================================
-- SUMMITSYNC — SCALABILITY FIX V3 (ROBUST CLEANUP)
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Drop NOT NULL constraint
ALTER TABLE participants ALTER COLUMN email DROP NOT NULL;

-- 2. Clean up bad email data
UPDATE participants
SET email = NULL
WHERE email = ''
   OR email LIKE '%@placeholder.com'
   OR email LIKE '%@badge.local';

-- 3. Drop ALL existing unique constraints that involve the email column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'participants'
      AND tc.constraint_type = 'UNIQUE'
      AND ccu.column_name = 'email'
  ) LOOP
    EXECUTE 'ALTER TABLE participants DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- 4. Create the correct unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'participants' AND constraint_name = 'participants_event_id_email_key'
  ) THEN
    ALTER TABLE participants ADD CONSTRAINT participants_event_id_email_key UNIQUE (event_id, email);
  END IF;
END $$;

-- 5. Performance indexes
CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_category ON participants(event_id, category);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(event_id, status);
CREATE INDEX IF NOT EXISTS idx_participants_gender_event ON participants(event_id, gender);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_participants_name_trgm ON participants USING gin(name gin_trgm_ops);

-- 6. Ensure gender column exists
ALTER TABLE participants ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT NULL;
