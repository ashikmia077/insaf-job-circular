-- ============================================================================
-- Migration 0001: Extensions & Enumerated Types for Insaf Job Circular
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Role-Based Access Control (RBAC) Roles for Multiple Administrators
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM (
    'super_admin',
    'verifier_admin',
    'editor_admin',
    'ad_manager',
    'analyst'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bangladesh Job Categories
DO $$ BEGIN
  CREATE TYPE public.job_category AS ENUM (
    'government',
    'bank',
    'autonomous',
    'defense',
    'ngo',
    'private',
    'education'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Job Verification & Lifecycle Status
DO $$ BEGIN
  CREATE TYPE public.job_verification_status AS ENUM (
    'ingested_raw',
    'ai_extracted',
    'pending_verification',
    'verified_official',
    'rejected_duplicate',
    'rejected_unverified',
    'published',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Official Notice File Format
DO $$ BEGIN
  CREATE TYPE public.notice_file_type AS ENUM (
    'pdf',
    'image'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insaf Computer First-Party Advertising Placement Slots
DO $$ BEGIN
  CREATE TYPE public.ad_placement_slot AS ENUM (
    'hero_banner',
    'job_detail_sidebar',
    'notice_viewer_footer',
    'deadline_alert_card',
    'mobile_sticky_bar'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
