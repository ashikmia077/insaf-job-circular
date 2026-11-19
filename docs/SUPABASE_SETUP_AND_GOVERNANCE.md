# Supabase Setup, Multi-Admin Governance & Environment Guide (Phase 2)

This guide covers connecting a production or staging **Supabase** instance to **Insaf Job Circular**, executing the 5 PostgreSQL migrations (`0001`–`0005`), bootstrapping the initial `SUPER_ADMIN`, and understanding the server + database role enforcement model.

---

## 1. Supabase Project Setup Guide

### Step 1: Create or Select Your Supabase Project
1. Sign in to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a new project in the Singapore (`ap-southeast-1`) or Mumbai (`ap-south-1`) region for low latency in Bangladesh.
2. Navigate to **Project Settings -> API** and copy:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **Anon Public Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **Service Role Secret Key** (`SUPABASE_SERVICE_ROLE_KEY` — **Server-only**, never expose in client code)

### Step 2: Apply the 5 SQL Migrations in Order
Open the **Supabase SQL Editor** (or use `supabase db push`) and execute the migration files in `database/migrations/` in exact numerical order:
1. `0001_initial_enums_and_extensions.sql`
2. `0002_core_tables.sql`
3. `0003_rls_policies_and_indexes.sql`
4. `0004_phase2_schema_extensions_and_tables.sql`
5. `0005_phase2_rls_triggers_and_audit_protection.sql`

### Step 3: Create Storage Buckets
In **Supabase Storage**, create the following 3 buckets:
- `job-notices` (Public read for verified notices; authenticated admin upload up to 20 MB for PDF / 8 MB for images)
- `organization-logos` (Public read; authenticated admin upload)
- `insaf-ad-creatives` (Public read; `SUPER_ADMIN` upload)

### Step 4: Bootstrap the Initial `SUPER_ADMIN`
1. In **Supabase Dashboard -> Authentication -> Users**, click **Add User -> Create New User** with your administrator email and a strong password (minimum 10 characters).
2. Copy the generated User `UUID` and run the following in the **Supabase SQL Editor**:
```sql
INSERT INTO public.admin_profiles (id, email, full_name, role, is_active)
VALUES (
  'YOUR-AUTH-USER-UUID',
  'your-admin@insafjobcircular.com',
  'Founding Super Admin',
  'SUPER_ADMIN',
  TRUE
);
```
3. You can now sign in at `/admin/login`.

---

## 2. Multi-Admin Role Governance Documentation

Insaf Job Circular enforces a strict **3-tier administrative governance model** across **Next.js Middleware**, **Domain Service Layer (`src/services/*`)**, and **PostgreSQL Row Level Security + Triggers**:

| Role | Database Enum | Allowed Capabilities | Hard Restrictions (Server & DB Enforced) |
| :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | `super_admin` / `SUPER_ADMIN` | Full system access: manage administrators (`admins:manage`), security settings (`security:manage`), crawl sources (`sources:manage`), jobs (`jobs:delete`), notices, verifications, ads, and audit logs (`audit:read`). | Cannot demote or deactivate their own active account (`SELF_LOCKOUT_PREVENTED`). Cannot modify or delete existing `audit_logs` rows. |
| **`EDITOR_ADMIN`** | `editor_admin` / `EDITOR_ADMIN` | Create and edit job circular drafts (`jobs:create`, `jobs:edit`), manage categories (`categories:manage`) and organizations (`organizations:manage`), upload PDF/image notice assets (`notices:upload`), and view analytics (`analytics:view`). | **Cannot** verify or publish unverified jobs (`EDITOR_CANNOT_PUBLISH` + PostgreSQL trigger `trg_jobs_publish_governance`). **Cannot** mark notices authentic (`notices:verify`). **Cannot** add crawl sources or change security/admin settings. |
| **`VERIFICATION_ADMIN`** | `verification_admin` / `verifier_admin` / `VERIFICATION_ADMIN` | Verify official notice authenticity (`notices:verify`), validate source compliance & trigger scans (`sources:validate`, `sources:scan`), approve & publish verified job circulars (`verification:approve`, `jobs:publish`), reject duplicates/unverified drafts (`verification:reject`), resolve user reports (`reports:resolve`), and send notifications (`notifications:send`). | **Cannot** publish a job without an attached official notice (`PUBLICATION_BLOCKED`). **Cannot** modify administrator roles (`admins:manage`) or system security settings (`security:manage`). |

---

## 3. Immutable Audit Log Architecture (`public.audit_logs`)

Every state-changing administrative action records:
- `actor_admin_id` (UUID of the administrator)
- `actor_role` (`SUPER_ADMIN`, `EDITOR_ADMIN`, `VERIFICATION_ADMIN`, or `system_worker`)
- `action` (e.g., `job.create_draft`, `verification.approve_and_publish`, `admin.update_governance`)
- `resource` (target table/resource name, e.g., `jobs`, `job_notices`, `admin_profiles`)
- `entity_id` (UUID of the affected record)
- `previous_state` (`JSONB` snapshot before mutation)
- `new_state` (`JSONB` snapshot after mutation)
- `created_at` (`TIMESTAMPTZ`)

**Tamper Protection:** PostgreSQL trigger `trg_audit_logs_immutable` (`public.prevent_audit_log_modification()`) intercepts any `BEFORE UPDATE OR DELETE ON public.audit_logs` and raises a hard database exception, guaranteeing append-only integrity.

---

## 4. Environment Variable Reference

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Client & Server | `"Insaf Job Circular"` | Application display name |
| `NEXT_PUBLIC_APP_URL` | Client & Server | `"http://localhost:3000"` | Canonical base URL used for password reset redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | — | Supabase project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | — | Supabase public anonymous JWT key (enforces RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Only** | — | Privileged key used strictly in `src/lib/supabase/admin.ts` |
| `RATE_LIMIT_AUTH_RPM` | **Server Only** | `10` | Max authentication / password-reset requests per minute per IP |
| `RATE_LIMIT_PUBLIC_RPM` | **Server Only** | `60` | Max public API requests per minute per IP |
| `RATE_LIMIT_ADMIN_RPM` | **Server Only** | `120` | Max authenticated admin API requests per minute per IP |
| `WORKER_WEBHOOK_SECRET` | **Server & Worker** | — | Shared secret (min 16 chars) for HMAC-SHA256 webhook verification |
