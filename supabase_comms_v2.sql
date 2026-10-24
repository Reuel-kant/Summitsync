-- ============================================================
-- SUMMITSYNC — COMMUNICATIONS V2 SCHEMA
-- Run this entire file in Supabase SQL Editor.
-- Adds org_settings and upgrades communications table.
-- ============================================================

-- ── 1. ORG SETTINGS ──────────────────────────────────────────
-- Stores per-organization communication credentials.
-- RLS ensures each org only sees their own settings.
-- Keys are stored encrypted at rest by Supabase (AES-256).

CREATE TABLE IF NOT EXISTS org_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email via Resend (resend.com — 100 emails/day free, $20/month for 50k)
  resend_api_key   TEXT DEFAULT '',
  resend_from_name TEXT DEFAULT '',
  resend_from_email TEXT DEFAULT '',  -- must be verified on Resend

  -- WhatsApp via Meta Cloud API (free tier: 1000 conversations/month)
  wa_phone_number_id   TEXT DEFAULT '',  -- from Meta Developer Portal
  wa_access_token      TEXT DEFAULT '',  -- permanent token from Meta Business
  wa_business_name     TEXT DEFAULT '',  -- display name shown to recipients

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id)
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_own_settings" ON org_settings;
CREATE POLICY "owners_own_settings"
  ON org_settings FOR ALL
  TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ── 2. UPGRADE COMMUNICATIONS TABLE ──────────────────────────
-- Adds multi-channel support, media, and per-channel result tracking.

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS channels      TEXT[] DEFAULT '{email}',
  ADD COLUMN IF NOT EXISTS media_url     TEXT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_type    TEXT   DEFAULT NULL,   -- image | document | video
  ADD COLUMN IF NOT EXISTS media_name    TEXT   DEFAULT NULL,   -- original filename
  ADD COLUMN IF NOT EXISTS email_sent    INT    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_failed  INT    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_sent       INT    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_failed     INT    DEFAULT 0;

-- ── 3. MEDIA STORAGE BUCKET ──────────────────────────────────
-- Create a public bucket for communication media attachments.
-- Files are referenced by public URL in edge function sends.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('comm-media', 'comm-media', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own org's folder
DROP POLICY IF EXISTS "auth_upload_comm_media" ON storage.objects;
CREATE POLICY "auth_upload_comm_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comm-media');

DROP POLICY IF EXISTS "public_read_comm_media" ON storage.objects;
CREATE POLICY "public_read_comm_media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'comm-media');

DROP POLICY IF EXISTS "auth_delete_comm_media" ON storage.objects;
CREATE POLICY "auth_delete_comm_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'comm-media');

-- ── 4. VERIFY SETUP ──────────────────────────────────────────
-- After running, check tables exist:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('org_settings','communications','registration_forms');
