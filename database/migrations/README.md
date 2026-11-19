# Database Migrations (`database/migrations/`)

This directory holds ordered, idempotent PostgreSQL migration files designed for **Supabase PostgreSQL**:

| Migration File | Purpose |
| :--- | :--- |
| `0001_initial_enums_and_extensions.sql` | Enables `pgcrypto` and `pg_trgm`; creates base enums (`admin_role`, `job_category`, `job_verification_status`, `notice_file_type`, `ad_placement_slot`). |
| `0002_core_tables.sql` | Creates the initial 11 core relational tables (`admin_profiles`, `organizations`, `job_sources`, `jobs`, `job_notices`, `job_verifications`, `duplicate_reports`, `push_subscriptions`, `insaf_ad_campaigns`, `analytics_events`, `audit_logs`). |
| `0003_rls_policies_and_indexes.sql` | Enables initial Row Level Security (RLS), defines `public.has_admin_role(...)`, configures initial public vs RBAC policies, and creates B-tree + GIN trigram indexes. |
| `0004_phase2_schema_extensions_and_tables.sql` | Extends existing tables with soft-delete (`deleted_at`), `updated_at`, and audit state columns (`resource`, `previous_state`, `new_state`); creates the 9 additional Phase 2 tables (`job_categories`, `source_scans`, `job_source_links`, `job_updates`, `profiles`, `saved_jobs`, `notifications`, `visitor_sessions`, `reports`) for a complete 20-table relational model. |
| `0005_phase2_rls_triggers_and_audit_protection.sql` | Adds role normalization (`SUPER_ADMIN`, `EDITOR_ADMIN`, `VERIFICATION_ADMIN`), immutable `audit_logs` protection trigger (`prevent_audit_log_modification`), database-level `EDITOR_ADMIN` unverified publish block trigger (`enforce_job_publish_governance`), privilege escalation block trigger (`prevent_admin_self_escalation`), `updated_at` triggers, and complete RLS policies + indexes across all 20 tables. |

## Applying Migrations

```bash
# Via Supabase CLI
supabase db push

# Or execute in order inside the Supabase SQL Editor:
# 1. 0001_initial_enums_and_extensions.sql
# 2. 0002_core_tables.sql
# 3. 0003_rls_policies_and_indexes.sql
# 4. 0004_phase2_schema_extensions_and_tables.sql
# 5. 0005_phase2_rls_triggers_and_audit_protection.sql
```
