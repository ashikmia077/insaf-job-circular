-- ============================================================================
-- Migration 0005: Phase 2 RLS Policies, Governance Triggers, Audit Protection & Indexes
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

-- 1. Role Normalization Helper (Maps SUPER_ADMIN / EDITOR_ADMIN / VERIFICATION_ADMIN)
CREATE OR REPLACE FUNCTION public.normalize_admin_role(raw_role TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE UPPER(TRIM(COALESCE(raw_role, '')))
    WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
    WHEN 'VERIFICATION_ADMIN' THEN 'VERIFICATION_ADMIN'
    WHEN 'VERIFIER_ADMIN' THEN 'VERIFICATION_ADMIN'
    WHEN 'EDITOR_ADMIN' THEN 'EDITOR_ADMIN'
    WHEN 'AD_MANAGER' THEN 'AD_MANAGER'
    WHEN 'ANALYST' THEN 'ANALYST'
    ELSE UPPER(TRIM(COALESCE(raw_role, '')))
  END;
$$;

-- 2. Upgrade has_admin_role() to normalize roles and check deleted_at IS NULL
CREATE OR REPLACE FUNCTION public.has_admin_role(allowed_roles public.admin_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles ap
    WHERE ap.id = auth.uid()
      AND ap.is_active = TRUE
      AND ap.deleted_at IS NULL
      AND public.normalize_admin_role(ap.role::TEXT) = ANY(
        ARRAY(
          SELECT public.normalize_admin_role(r::TEXT)
          FROM unnest(allowed_roles) AS r
        )
      )
  );
$$;

-- 3. Automatic updated_at Timestamp Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_profiles',
    'job_categories',
    'organizations',
    'job_sources',
    'jobs',
    'job_notices',
    'push_subscriptions',
    'insaf_ad_campaigns',
    'profiles',
    'reports'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 4. Immutable Audit Log Trigger (Prevents UPDATE or DELETE on audit_logs)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY VIOLATION: public.audit_logs is append-only. Modification or deletion of audit records is prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 5. Database-Level Governance Trigger on jobs (Prevents EDITOR_ADMIN from publishing)
CREATE OR REPLACE FUNCTION public.enforce_job_publish_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role TEXT;
BEGIN
  -- Determine authenticated actor role if called within an authenticated user session
  IF auth.uid() IS NOT NULL THEN
    SELECT public.normalize_admin_role(ap.role::TEXT)
      INTO v_actor_role
      FROM public.admin_profiles ap
     WHERE ap.id = auth.uid()
       AND ap.is_active = TRUE
       AND ap.deleted_at IS NULL;

    -- EDITOR_ADMIN cannot publish or mark a job verified_official
    IF v_actor_role = 'EDITOR_ADMIN' AND NEW.verification_status IN ('published', 'verified_official') THEN
      RAISE EXCEPTION 'RBAC VIOLATION: EDITOR_ADMIN cannot independently verify or publish job circulars.';
    END IF;
  END IF;

  IF NEW.verification_status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_publish_governance ON public.jobs;
CREATE TRIGGER trg_jobs_publish_governance
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_publish_governance();

-- 6. Database-Level Privilege Escalation Guard on admin_profiles
CREATE OR REPLACE FUNCTION public.prevent_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF (
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    ) AND NOT public.has_admin_role(ARRAY['super_admin']::public.admin_role[]) THEN
      RAISE EXCEPTION 'RBAC VIOLATION: Only SUPER_ADMIN can modify administrator roles or activation status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_profiles_no_escalation ON public.admin_profiles;
CREATE TRIGGER trg_admin_profiles_no_escalation
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_self_escalation();

-- ============================================================================
-- 7. Enable Row Level Security (RLS) on All New Tables
-- ============================================================================
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. Least-Privilege RLS Policies for New & Extended Tables
-- ============================================================================

-- 8.1 job_categories
DROP POLICY IF EXISTS "public_read_active_categories" ON public.job_categories;
CREATE POLICY "public_read_active_categories"
  ON public.job_categories FOR SELECT
  USING (is_active = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS "admins_manage_categories" ON public.job_categories;
CREATE POLICY "admins_manage_categories"
  ON public.job_categories FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'editor_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'editor_admin']::public.admin_role[])
  );

-- 8.2 organizations (Admin write policies + soft-delete aware public read)
DROP POLICY IF EXISTS "public_read_organizations" ON public.organizations;
CREATE POLICY "public_read_organizations"
  ON public.organizations FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "admins_manage_organizations" ON public.organizations;
CREATE POLICY "admins_manage_organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

-- 8.3 jobs (Soft-delete aware public read +SUPER_ADMIN delete)
DROP POLICY IF EXISTS "public_read_published_jobs" ON public.jobs;
CREATE POLICY "public_read_published_jobs"
  ON public.jobs FOR SELECT
  USING (verification_status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "super_admin_delete_jobs" ON public.jobs;
CREATE POLICY "super_admin_delete_jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin']::public.admin_role[])
  );

-- 8.4 job_verifications & duplicate_reports
DROP POLICY IF EXISTS "admins_read_job_verifications" ON public.job_verifications;
CREATE POLICY "admins_read_job_verifications"
  ON public.job_verifications FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "verifiers_insert_job_verifications" ON public.job_verifications;
CREATE POLICY "verifiers_insert_job_verifications"
  ON public.job_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "admins_manage_duplicate_reports" ON public.duplicate_reports;
CREATE POLICY "admins_manage_duplicate_reports"
  ON public.duplicate_reports FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

-- 8.5 source_scans & job_source_links
DROP POLICY IF EXISTS "admins_read_source_scans" ON public.source_scans;
CREATE POLICY "admins_read_source_scans"
  ON public.source_scans FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "verifiers_and_super_admins_manage_source_scans" ON public.source_scans;
CREATE POLICY "verifiers_and_super_admins_manage_source_scans"
  ON public.source_scans FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "admins_read_job_source_links" ON public.job_source_links;
CREATE POLICY "admins_read_job_source_links"
  ON public.job_source_links FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "verifiers_and_super_admins_manage_source_links" ON public.job_source_links;
CREATE POLICY "verifiers_and_super_admins_manage_source_links"
  ON public.job_source_links FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

-- 8.6 job_updates
DROP POLICY IF EXISTS "public_read_published_job_updates" ON public.job_updates;
CREATE POLICY "public_read_published_job_updates"
  ON public.job_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_updates.job_id
        AND j.verification_status = 'published'
        AND j.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "admins_manage_job_updates" ON public.job_updates;
CREATE POLICY "admins_manage_job_updates"
  ON public.job_updates FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  );

-- 8.7 profiles & saved_jobs & notifications
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.profiles;
CREATE POLICY "users_manage_own_profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (id = auth.uid() OR public.has_admin_role(ARRAY['super_admin']::public.admin_role[]))
  WITH CHECK (id = auth.uid() OR public.has_admin_role(ARRAY['super_admin']::public.admin_role[]));

DROP POLICY IF EXISTS "users_manage_own_saved_jobs" ON public.saved_jobs;
CREATE POLICY "users_manage_own_saved_jobs"
  ON public.saved_jobs FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "users_read_own_notifications" ON public.notifications;
CREATE POLICY "users_read_own_notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    recipient_profile_id = auth.uid()
    OR public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

DROP POLICY IF EXISTS "admins_manage_notifications" ON public.notifications;
CREATE POLICY "admins_manage_notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

-- 8.8 reports
DROP POLICY IF EXISTS "anyone_create_report" ON public.reports;
CREATE POLICY "anyone_create_report"
  ON public.reports FOR INSERT
  WITH CHECK (status = 'open');

DROP POLICY IF EXISTS "admins_manage_reports" ON public.reports;
CREATE POLICY "admins_manage_reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin']::public.admin_role[])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['super_admin', 'verifier_admin']::public.admin_role[])
  );

-- 8.9 visitor_sessions & analytics_events & audit_logs insert
DROP POLICY IF EXISTS "admins_read_visitor_sessions" ON public.visitor_sessions;
CREATE POLICY "admins_read_visitor_sessions"
  ON public.visitor_sessions FOR SELECT
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['super_admin', 'analyst']::public.admin_role[])
  );

DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_insert_audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_admin_id = auth.uid()
    AND public.has_admin_role(ARRAY['super_admin', 'verifier_admin', 'editor_admin', 'ad_manager']::public.admin_role[])
  );

-- ============================================================================
-- 9. Phase 2 Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_job_categories_order
  ON public.job_categories (display_order ASC)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_category_id
  ON public.organizations (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_organization_id
  ON public.jobs (organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_category_id
  ON public.jobs (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_source_scans_source_started
  ON public.source_scans (source_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_source_links_source_status
  ON public.job_source_links (source_id, link_status);

CREATE INDEX IF NOT EXISTS idx_job_updates_job_created
  ON public.job_updates (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_profile
  ON public.saved_jobs (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_profile_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON public.reports (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON public.audit_logs (actor_admin_id, created_at DESC);
