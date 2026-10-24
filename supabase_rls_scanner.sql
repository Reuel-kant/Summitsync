-- ============================================================
-- SUMMITSYNC — SCANNER NODE RLS POLICIES
-- Run this entire file in your Supabase SQL Editor.
-- These policies allow unauthenticated scanner nodes (opened
-- via a join link) to read events/sessions and write scan data.
-- ============================================================

-- ── 1. EVENTS ───────────────────────────────────────────────
-- Scanner nodes need to SELECT the event when validating the
-- join link in App.tsx handleJoinLink(). Without this, the
-- link silently fails and lands the user on the login screen.

DROP POLICY IF EXISTS "anon_can_read_events" ON events;
CREATE POLICY "anon_can_read_events"
  ON events FOR SELECT
  TO anon
  USING (true);

-- ── 2. SESSIONS ─────────────────────────────────────────────
-- Scanner nodes need to SELECT sessions to show the session
-- picker (Main Event / Session A / Session B etc).

DROP POLICY IF EXISTS "anon_can_read_sessions" ON sessions;
CREATE POLICY "anon_can_read_sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

-- ── 3. PARTICIPANTS ──────────────────────────────────────────
-- handleScanSuccess() upserts a participant row on every scan
-- (creates them if they don't exist, updates status to
-- 'Verified' if they do). Both INSERT and UPDATE are needed.

DROP POLICY IF EXISTS "anon_can_insert_participants" ON participants;
CREATE POLICY "anon_can_insert_participants"
  ON participants FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_can_update_participants" ON participants;
CREATE POLICY "anon_can_update_participants"
  ON participants FOR UPDATE
  TO anon
  USING (true);

-- Scanner nodes also need SELECT to check for duplicate scans
-- (the dup-guard query in handleScanSuccess reads attendance_logs,
-- not participants — but supabase upsert internally does a SELECT).
DROP POLICY IF EXISTS "anon_can_read_participants" ON participants;
CREATE POLICY "anon_can_read_participants"
  ON participants FOR SELECT
  TO anon
  USING (true);

-- ── 4. ATTENDANCE LOGS ───────────────────────────────────────
-- The final step of every scan is inserting a row into
-- attendance_logs. Without this policy, the log never saves.

DROP POLICY IF EXISTS "anon_can_insert_logs" ON attendance_logs;
CREATE POLICY "anon_can_insert_logs"
  ON attendance_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Scanner nodes also need SELECT on attendance_logs to run the
-- duplicate-check query before inserting (prevents the same
-- guest being logged twice in the same session on the same day).
DROP POLICY IF EXISTS "anon_can_read_logs" ON attendance_logs;
CREATE POLICY "anon_can_read_logs"
  ON attendance_logs FOR SELECT
  TO anon
  USING (true);

-- ── 5. CONFIRM RLS IS ENABLED ───────────────────────────────
-- These lines are safe to run even if RLS is already on.

ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs  ENABLE ROW LEVEL SECURITY;
