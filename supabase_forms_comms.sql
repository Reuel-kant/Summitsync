-- ============================================================
-- SUMMITSYNC — REGISTRATION FORMS & COMMUNICATIONS SCHEMA
-- Run this entire file in your Supabase SQL Editor.
-- ============================================================

-- ── 1. REGISTRATION FORMS ────────────────────────────────────
-- Stores the form schema (fields config) for each event.
-- One form per event (UNIQUE on event_id).

CREATE TABLE IF NOT EXISTS registration_forms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fields       JSONB NOT NULL DEFAULT '[]',
  settings     JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_forms_event ON registration_forms(event_id);

-- ── 2. COMMUNICATIONS ────────────────────────────────────────
-- Stores every message broadcast sent (or drafted) for an event.

CREATE TABLE IF NOT EXISTS communications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject           TEXT NOT NULL DEFAULT '',
  body_template     TEXT NOT NULL DEFAULT '',
  recipient_filter  JSONB NOT NULL DEFAULT '{"type":"all"}',
  sent_count        INT DEFAULT 0,
  failed_count      INT DEFAULT 0,
  status            TEXT DEFAULT 'draft',  -- draft | sending | sent | partial
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comms_event ON communications(event_id);

-- ── 3. RLS POLICIES ─────────────────────────────────────────

ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications     ENABLE ROW LEVEL SECURITY;

-- Authenticated event owners can do everything on their forms
DROP POLICY IF EXISTS "owners_manage_forms"    ON registration_forms;
CREATE POLICY "owners_manage_forms"
  ON registration_forms FOR ALL
  TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()));

-- Anon users can READ active forms (to render the public registration page)
DROP POLICY IF EXISTS "anon_read_active_forms" ON registration_forms;
CREATE POLICY "anon_read_active_forms"
  ON registration_forms FOR SELECT
  TO anon
  USING (is_active = true);

-- Authenticated event owners can manage their communications
DROP POLICY IF EXISTS "owners_manage_comms" ON communications;
CREATE POLICY "owners_manage_comms"
  ON communications FOR ALL
  TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_id = auth.uid()));

-- ── 4. EMAIL DELIVERY SETUP NOTE ─────────────────────────────
-- Communications are sent via EmailJS (https://emailjs.com).
-- After running this SQL, add these to your .env file:
--
--   VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
--   VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
--   VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
--
-- EmailJS template variables to configure (in their dashboard):
--   {{to_name}}    — recipient's full name
--   {{to_email}}   — recipient's email address
--   {{subject}}    — email subject line
--   {{message}}    — personalised message body
--   {{event_name}} — the event name
--   {{from_name}}  — organiser / event name (reply-from label)
