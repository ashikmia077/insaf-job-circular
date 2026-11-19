# Database Migrations (`database/migrations/`)

This directory holds ordered, idempotent PostgreSQL migration files designed for **Supabase PostgreSQL**:

| Migration File | Purpose |
| :--- | :--- |
| `0001_initial_enums_and_extensions.sql` | Enables `pgcrypto` and `pg_trgm`; creates enums (`admin_role`, `job_category`, `job_verification_status`, `notice_file_type`, `ad_placement_slot`). |
| `0002_core_tables.sql` | Creates the 11 normalized relational tables (`admin_profiles`, `organizations`, `job_sources`, `jobs`, `job_notices`, `job_verifications`, `duplicate_reports`, `push_subscriptions`, `insaf_ad_campaigns`, `analytics_events`, `audit_logs`). |
| `0003_rls_policies_and_indexes.sql` | Enables Row Level Security (RLS) on all tables, defines `public.has_admin_role(...)`, configures public vs RBAC policies, and creates B-tree + GIN trigram indexes. |

## Applying Migrations (Phase 2+)

Once the Phase 1 architecture is approved and a Supabase project is linked:

```bash
# Via Supabase CLI
supabase db push

# Or execute in order inside the Supabase SQL Editor:
# 1. 0001_initial_enums_and_extensions.sql
# 2. 0002_core_tables.sql
# 3. 0003_rls_policies_and_indexes.sql
```
