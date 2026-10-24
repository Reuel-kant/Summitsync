-- ============================================================
-- SUMMITSYNC — SCALABILITY FIX (CORRECTED ORDER)
-- Run this in your Supabase SQL Editor.
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── STEP 1: Drop NOT NULL constraint FIRST ───────────────────
-- Must happen before we can set any emails to NULL.
ALTER TABLE participants
  ALTER COLUMN email DROP NOT NULL;

-- ── STEP 2: Now clean up bad email data ──────────────────────
-- Convert empty strings and AI-generated placeholder emails to NULL.
UPDATE participants
SET email = NULL
WHERE email = ''
   OR email LIKE '%@placeholder.com'
   OR email LIKE '%@badge.local';

-- ── STEP 3: Drop the old broken unique constraint ─────────────
-- It treated '' and NULL the same, causing conflicts for emailless guests.
DO $$
DECLARE
  c TEXT;
BEGIN
  SELECT constraint_name INTO c
    FROM information_schema.table_constraints
   WHERE table_name = 'participants'
     AND constraint_type = 'UNIQUE'
     AND constraint_name LIKE '%email%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE participants DROP CONSTRAINT ' || c;
  END IF;
END $$;

-- ── STEP 4: Create the correct unique constraint ───────────
-- Enforces uniqueness on (event_id, email).
-- Because email can be NULL, multiple guests with NULL email can coexist (NULL != NULL in SQL).
-- This allows Supabase upsert with onConflict: 'event_id,email' to work correctly.
DROP INDEX IF EXISTS idx_participants_event_email_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'participants' AND constraint_name = 'participants_event_id_email_key'
  ) THEN
    ALTER TABLE participants ADD CONSTRAINT participants_event_id_email_key UNIQUE (event_id, email);
  END IF;
END $$;

-- ── STEP 5: Performance indexes ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_participants_event_id
  ON participants(event_id);

CREATE INDEX IF NOT EXISTS idx_participants_category
  ON participants(event_id, category);

CREATE INDEX IF NOT EXISTS idx_participants_status
  ON participants(event_id, status);

CREATE INDEX IF NOT EXISTS idx_participants_gender_event
  ON participants(event_id, gender);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_participants_name_trgm
  ON participants USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_time
  ON attendance_logs(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_participant
  ON attendance_logs(participant_id);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_session
  ON attendance_logs(session_id)
  WHERE session_id IS NOT NULL;

-- ── STEP 6: Ensure gender column exists ───────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT NULL;

-- ── STEP 7: RLS Policies ──────────────────────────────────────
DROP POLICY IF EXISTS "owner_participants_all"   ON participants;
DROP POLICY IF EXISTS "anon_participants_insert" ON participants;
DROP POLICY IF EXISTS "anon_participants_select" ON participants;
DROP POLICY IF EXISTS "anon_participants_update" ON participants;

CREATE POLICY "owner_participants_all"
  ON participants FOR ALL TO authenticated
  USING  (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()));

CREATE POLICY "anon_participants_insert"
  ON participants FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_participants_select"
  ON participants FOR SELECT TO anon USING (true);

CREATE POLICY "anon_participants_update"
  ON participants FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_logs_all"  ON attendance_logs;
DROP POLICY IF EXISTS "anon_logs_write" ON attendance_logs;
DROP POLICY IF EXISTS "anon_logs_read"  ON attendance_logs;

CREATE POLICY "owner_logs_all"
  ON attendance_logs FOR ALL TO authenticated
  USING  (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()));

CREATE POLICY "anon_logs_write"
  ON attendance_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_logs_read"
  ON attendance_logs FOR SELECT TO anon USING (true);

-- ── VERIFY ────────────────────────────────────────────────────
-- Run these to confirm everything is correct:
--
-- SELECT column_name, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'participants' AND column_name = 'email';
-- → should show is_nullable = YES
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'participants';
-- → should list idx_participants_event_email_unique and others
