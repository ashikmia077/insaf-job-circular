-- ============================================================================
-- Migration 0003: Supabase Row Level Security (RLS) & Performance Indexes
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

-- Enable RLS on every table
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insaf_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if current authenticated user is an active admin with one of the specified roles
CREATE OR REPLACE FUNCTION public.has_admin_role(allowed_roles public.admin_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles ap
    WHERE ap.id = auth.uid()
      AND ap.is_active = TRUE
      AND ap.role = ANY(allowed_roles)
  );
$$;

-- 1. Public Read Policies (Strictly Published & Active Entities)
CREATE POLICY "public_read_organizations"
  ON public.organizations FOR SELECT
  USING (TRUE);

CREATE POLICY "public_read_published_jobs"
  ON public.jobs FOR SELECT
  USING (verification_status = 'published');

CREATE POLICY "public_read_verified_notices"
  ON public.job_notices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_notices.job_id
        AND j.verification_status = 'published'
    )
  );

CREATE POLICY "public_read_active_insaf_ads"
  ON public.insaf_ad_campaigns FOR SELECT
  USING (
    is_active = TRUE
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- 2. Admin RBAC Policies
CREATE POLICY "admins_read_all_jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin', 'analyst']::public.admin_role[])
  );

CREATE POLICY "editors_and_verifiers_insert_jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

CREATE POLICY "verifiers_and_super_admins_update_jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

CREATE POLICY "ad_managers_manage_insaf_campaigns"
  ON public.insaf_ad_campaigns FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'ad_manager']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'ad_manager']::public.admin_role[])
  );

CREATE POLICY "super_admin_and_analyst_read_audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'analyst']::public.admin_role[])
  );

-- 3. Performance & Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status_deadline
  ON public.jobs (verification_status, application_deadline_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_category_published
  ON public.jobs (category, published_at DESC)
  WHERE verification_status = 'published';

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm
  ON public.jobs USING gin (title_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_job_notices_job_id
  ON public.job_notices (job_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id, created_at DESC);
