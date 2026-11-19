-- ============================================================================
-- Migration 0004: Phase 2 Schema Extensions & Complete 20-Table Domain Model
-- Target: Supabase PostgreSQL 15+
-- ============================================================================
-- Preserves all Phase 1 tables and data while extending existing tables and
-- creating the remaining tables required for Phase 2 governance.
-- ============================================================================

-- 1. Extend admin_role enum to support canonical Phase 2 role identifiers
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'verification_admin';
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'EDITOR_ADMIN';
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'VERIFICATION_ADMIN';

-- 2. Additional Phase 2 Status Enums
DO $$ BEGIN
  CREATE TYPE public.source_scan_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.source_link_status AS ENUM (
    'discovered',
    'fetched',
    'extracted',
    'duplicate',
    'failed',
    'blocked_robots'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_update_type AS ENUM (
    'corrigendum',
    'deadline_extension',
    'vacancy_revision',
    'notice_replacement',
    'editorial_correction',
    'status_change'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'new_verified_job',
    'deadline_reminder',
    'job_update',
    'system_alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_delivery_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'read'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM (
    'incorrect_deadline',
    'broken_apply_link',
    'fake_or_scam_circular',
    'duplicate_job',
    'notice_unreadable',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM (
    'open',
    'under_review',
    'resolved',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. Table 12: job_categories (Relational Category Taxonomy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category_enum public.job_category NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  description_en TEXT,
  description_bn TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Briefcase',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical Bangladesh job categories idempotently
INSERT INTO public.job_categories (slug, category_enum, name_en, name_bn, icon_name, display_order)
VALUES
  ('government', 'government', 'Government Jobs', 'সরকারি চাকরি', 'Landmark', 1),
  ('bank', 'bank', 'Bank & Financial', 'ব্যাংক ও আর্থিক প্রতিষ্ঠান', 'Building2', 2),
  ('autonomous', 'autonomous', 'Autonomous Bodies', 'স্বায়ত্তশাসিত প্রতিষ্ঠান', 'Shield', 3),
  ('defense', 'defense', 'Defense & Forces', 'প্রতিরক্ষা ও বাহিনী', 'Award', 4),
  ('ngo', 'ngo', 'NGO & Development', 'এনজিও ও উন্নয়ন সংস্থা', 'HeartHandshake', 5),
  ('private', 'private', 'Private & Corporate', 'বেসরকারি ও কর্পোরেট', 'Briefcase', 6),
  ('education', 'education', 'Teacher & Education', 'শিক্ষক ও শিক্ষা প্রতিষ্ঠান', 'GraduationCap', 7)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 4. Non-Destructive Extensions to Existing 11 Tables
-- ============================================================================

-- 4.1 admin_profiles extensions
ALTER TABLE public.admin_profiles
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.2 organizations extensions
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS is_verified_organization BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.3 job_sources extensions
ALTER TABLE public.job_sources
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.4 jobs extensions
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.5 job_notices extensions
ALTER TABLE public.job_notices
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  ADD COLUMN IF NOT EXISTS uploaded_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.6 insaf_ad_campaigns extensions
ALTER TABLE public.insaf_ad_campaigns
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.7 audit_logs extensions (Requirement 5: Admin ID, Action, Resource, Previous State, New State, Timestamp)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS resource TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS previous_state JSONB,
  ADD COLUMN IF NOT EXISTS new_state JSONB,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ============================================================================
-- 5. Table 13: source_scans (Automated & Manual Source Scan Runs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.source_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  triggered_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  scan_status public.source_scan_status NOT NULL DEFAULT 'queued',
  links_discovered INTEGER NOT NULL DEFAULT 0 CHECK (links_discovered >= 0),
  new_jobs_ingested INTEGER NOT NULL DEFAULT 0 CHECK (new_jobs_ingested >= 0),
  duplicates_skipped INTEGER NOT NULL DEFAULT 0 CHECK (duplicates_skipped >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. Table 14: job_source_links (Discovered Circular Links per Source)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.source_scans(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  discovered_url TEXT NOT NULL,
  canonical_url_hash CHAR(64) NOT NULL,
  link_status public.source_link_status NOT NULL DEFAULT 'discovered',
  http_status_code INTEGER,
  content_sha256 CHAR(64),
  error_message TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, canonical_url_hash)
);

-- ============================================================================
-- 7. Table 15: job_updates (Corrigendums, Deadline Extensions & Revisions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  update_type public.job_update_type NOT NULL,
  summary_en TEXT NOT NULL,
  summary_bn TEXT,
  previous_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  new_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  notice_id UUID REFERENCES public.job_notices(id) ON DELETE SET NULL,
  created_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. Table 16: profiles (Public Job Seeker / Subscriber User Profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  preferred_categories public.job_category[] NOT NULL DEFAULT '{}',
  email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. Table 17: saved_jobs (User Bookmarked Job Circulars)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  notes TEXT,
  deadline_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, job_id)
);

-- ============================================================================
-- 10. Table 18: notifications (User & System Notification History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  notification_type public.notification_type NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT,
  body_en TEXT NOT NULL,
  body_bn TEXT,
  target_url TEXT NOT NULL DEFAULT '/',
  delivery_status public.notification_delivery_status NOT NULL DEFAULT 'queued',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. Table 19: visitor_sessions (Privacy-Preserving Session Metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash CHAR(64) NOT NULL UNIQUE,
  device_type TEXT NOT NULL DEFAULT 'mobile',
  country_code CHAR(2) NOT NULL DEFAULT 'BD',
  entry_path TEXT NOT NULL DEFAULT '/',
  referrer_domain TEXT,
  page_views_count INTEGER NOT NULL DEFAULT 1 CHECK (page_views_count >= 1),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. Table 20: reports (Public & Admin Inaccuracy / Scam Circular Reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  reporter_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_email TEXT,
  report_type public.report_type NOT NULL,
  description TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'open',
  resolved_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link analytics_events to visitor_sessions optionally
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.visitor_sessions(id) ON DELETE SET NULL;
