-- ============================================================================
-- Migration 0002: Core Relational Tables for Insaf Job Circular
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

-- 1. Administrator Profiles (Linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.admin_role NOT NULL DEFAULT 'editor_admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Organizations (Government Ministries, Banks, NGOs, Corporations)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_bn TEXT,
  slug TEXT NOT NULL UNIQUE,
  category public.job_category NOT NULL,
  official_domain TEXT,
  is_trusted_government_domain BOOLEAN NOT NULL DEFAULT FALSE,
  logo_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tracked Job Sources (Compliant Public Portals & Feeds)
CREATE TABLE IF NOT EXISTS public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  official_domain TEXT NOT NULL,
  robots_txt_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (poll_interval_minutes >= 15),
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Job Circulars (Core Entity with Deduplication & Auto-Publish Metadata)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_bn TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_id UUID REFERENCES public.job_sources(id) ON DELETE SET NULL,
  category public.job_category NOT NULL,
  vacancy_count INTEGER CHECK (vacancy_count IS NULL OR vacancy_count > 0),
  salary_range_text TEXT,
  educational_requirements TEXT,
  experience_requirements TEXT,
  age_limit_text TEXT,
  application_fee_text TEXT,
  application_url TEXT,
  official_source_url TEXT NOT NULL,
  published_on_source_at TIMESTAMPTZ,
  application_start_at TIMESTAMPTZ,
  application_deadline_at TIMESTAMPTZ NOT NULL,
  verification_status public.job_verification_status NOT NULL DEFAULT 'pending_verification',
  ai_confidence_score NUMERIC(4,3) CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 1)),
  canonical_fingerprint CHAR(64) NOT NULL UNIQUE,
  auto_published BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  views_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Official Notice Assets (PDF & Image Notices in Supabase Storage)
CREATE TABLE IF NOT EXISTS public.job_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  file_type public.notice_file_type NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'job-notices',
  storage_path TEXT NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count >= 1),
  ocr_raw_text TEXT,
  is_primary_notice BOOLEAN NOT NULL DEFAULT TRUE,
  verified_authentic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (file_sha256)
);

-- 6. Verification & Auto-Publish Decision History
CREATE TABLE IF NOT EXISTS public.job_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  is_automated_check BOOLEAN NOT NULL DEFAULT FALSE,
  previous_status public.job_verification_status NOT NULL,
  new_status public.job_verification_status NOT NULL,
  domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
  checksum_verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Duplicate Detection Reports
CREATE TABLE IF NOT EXISTS public.duplicate_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  duplicate_source_url TEXT NOT NULL,
  matched_fingerprint CHAR(64),
  matched_notice_sha256 CHAR(64),
  similarity_score NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Web Push Notification Subscriptions (FCM Tokens & Topic Preferences)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fcm_token TEXT NOT NULL UNIQUE,
  subscribed_categories public.job_category[] NOT NULL DEFAULT '{}',
  deadline_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Insaf Computer Advertising Campaigns
CREATE TABLE IF NOT EXISTS public.insaf_ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  headline_bn TEXT NOT NULL,
  headline_en TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  contact_phone TEXT,
  placement_slot public.ad_placement_slot NOT NULL,
  creative_storage_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  impressions_count BIGINT NOT NULL DEFAULT 0,
  clicks_count BIGINT NOT NULL DEFAULT 0,
  created_by_admin_id UUID NOT NULL REFERENCES public.admin_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Visitor & Ad Analytics Events (Privacy-Preserving)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  ad_campaign_id UUID REFERENCES public.insaf_ad_campaigns(id) ON DELETE SET NULL,
  device_type TEXT NOT NULL DEFAULT 'mobile',
  referrer_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Immutable Administrative Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id UUID REFERENCES public.admin_profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
