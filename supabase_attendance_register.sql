-- ============================================================
-- SUMMITSYNC — ATTENDANCE REGISTER SCHEMA UPDATE
-- Run in Supabase SQL Editor.
-- Adds gender field to participants so it appears in the
-- Attendance Register export and print.
-- ============================================================

-- ── 1. Add gender column to participants ─────────────────────
-- TEXT is more flexible than an enum — allows "Male", "Female",
-- "Non-binary", "Prefer not to say", etc.
-- IF NOT EXISTS prevents errors on re-run.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';

-- ── 2. Index for any gender-based filtering ──────────────────
-- Small table, optional — but good practice.
CREATE INDEX IF NOT EXISTS idx_participants_gender ON participants(gender);

-- ── 3. Backfill from custom_data if gender was stored there ──
-- If any existing records stored gender in custom_data->>'gender',
-- migrate it to the new column.

UPDATE participants
SET gender = custom_data->>'gender'
WHERE gender = ''
  AND custom_data->>'gender' IS NOT NULL
  AND custom_data->>'gender' != '';

-- ── 4. Confirm ────────────────────────────────────────────────
-- After running, verify with:
--   SELECT id, name, gender FROM participants LIMIT 10;
