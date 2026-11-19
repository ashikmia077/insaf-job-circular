# Security, RBAC & Legal Scraping Compliance Specification

## 1. Secret Management Rules
- **Client Variables (`NEXT_PUBLIC_*`)**: Restricted to application URL, public Supabase anon key (protected by PostgreSQL RLS), and public Firebase Web Push VAPID key.
- **Server-Only Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `FIREBASE_PRIVATE_KEY`, `WORKER_WEBHOOK_SECRET`, and `AI_EXTRACTION_API_KEY` must never be exposed to client components.
- `src/config/env.config.ts` enforces a hard runtime guard (`typeof window !== "undefined"`) inside `getServerEnv()`.

## 2. Supabase Row Level Security (RLS)
Defined in `database/migrations/0003_rls_policies_and_indexes.sql`:
- Anonymous visitors can only `SELECT` rows in `public.jobs` where `verification_status = 'published'`.
- Unverified drafts, AI extraction candidates, and rejected duplicates are invisible to public queries.
- Write operations require an authenticated session mapped in `public.admin_profiles` with `is_active = TRUE` and the appropriate `public.admin_role`.

## 3. Ethical & Legal Source Collection Policy
Implemented in `workers/insaf_worker/compliance.py`:
- **Domain Allowlist**: Only public institutional domains (`.gov.bd`, `.org.bd`, `.edu.bd`, `.ac.bd`, `.mil.bd`) or explicitly approved partner feeds are polled.
- **`robots.txt` Enforcement**: Every target URL is checked against the site's `/robots.txt` using Python's `urllib.robotparser` before any request is made.If `robots.txt` disallows access or is unreachable, the collector fails closed.
- **Rate Throttling**: Minimum delay between requests to the same host is enforced (`WORKER_MIN_REQUEST_DELAY_SECONDS >= 5`).
- **Attribution**: Every published job circular displays a prominent link to `official_source_url` and credits the issuing organization.
