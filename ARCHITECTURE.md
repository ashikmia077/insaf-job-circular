# System Architecture — Insaf Job Circular

## 1. High-Level System Overview

**Insaf Job Circular** is architected as a decoupled, event-driven platform separating **user-facing web/PWA delivery and administrative governance (Next.js on Vercel)** from **long-running, compute-intensive collection, OCR/AI extraction, and deduplication workloads (Python Background Workers + Redis Queue)**.

```text
+-----------------------------------------------------------------------------------+
|                        CLIENT LAYER (Responsive Web + PWA)                        |
|  - Job Seekers (Bengali/English UI, PDF/Image Notice Viewer, Deadline Tracker)    |
|  - Service Worker (sw.js) + FCM Web Push Subscriptions                            |
|  - Multi-Role Admin Console (Super Admin, Verifier, Editor, Ad Manager, Analyst)  |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS (TLS 1.3)
                                          v
+-----------------------------------------------------------------------------------+
|                   APPLICATION & API LAYER (Next.js App Router)                    |
|  - Server Components (SEO-optimized SSR/ISR for Job Circulars & Categories)       |
|  - API Route Handlers (/api/v1/*) with Zod Validation & Sliding-Window Rate Limit |
|  - RBAC Guard Middleware + Immutable Audit Logger                                 |
|  - HMAC-SHA256 Verified Worker Webhook Receiver (/api/v1/webhooks/worker)         |
+-------------------+-----------------------------+---------------------------------+
                    |                             |
     Supabase SSR   |                             | Redis Queue Enqueue / Rate Limit
     & Service Role |                             v
                    |             +-------------------------------------------------+
                    |             |         QUEUE & CACHE LAYER (Redis)             |
                    |             |  - queue:job:collect                            |
                    |             |  - queue:job:extract_ai                         |
                    |             |  - queue:job:deduplicate                        |
                    |             |  - queue:job:verify_source                      |
                    |             |  - queue:notification:dispatch                  |
                    |             +-----------------------+-------------------------+
                    |                                     |
                    v                                     v
+-----------------------------------+     +-----------------------------------------+
|   DATA & STORAGE LAYER (Supabase) |     |  AUTOMATION LAYER (Python Workers)      |
|  - PostgreSQL 15+ (11 RLS Tables) |<--->|  - robots.txt & Allowlist Compliance    |
|  - Supabase Auth (JWT + RBAC)     |     |  - Official Portal & Feed Collector     |
|  - Supabase Storage Buckets:      |     |  - AI OCR/NLP Bilingual Extractor       |
|    * job-notices (PDF/Images)     |     |  - 3-Layer Deduplication Engine         |
|    * organization-logos           |     |  - Official Domain & Hash Verifier      |
|    * insaf-ad-creatives           |     +-----------------------------------------+
+-----------------------------------+
```

---

## 2. Core Functional Subsystems

### 2.1 Multi-Administrator Role-Based Access Control (RBAC)
Five distinct administrative roles are enforced both at the **Next.js API layer** (`src/config/permissions.config.ts`, `src/lib/security/rbac.ts`) and at the **PostgreSQL Row Level Security (RLS) layer** (`database/migrations/0003_rls_policies_and_indexes.sql`):

| Role | Primary Responsibilities | Allowed Permissions |
| :--- | :--- | :--- |
| `super_admin` | Full platform governance, role assignment, source & worker control | All permissions (`*`) |
| `verifier_admin` | Official notice authentication, job approval & publishing, push broadcast | `jobs:create`, `jobs:edit`, `jobs:publish`, `notices:upload`, `notices:verify`, `notifications:send`, `analytics:view` |
| `editor_admin` | Drafting job circulars, uploading notice assets, fixing OCR text | `jobs:create`, `jobs:edit`, `notices:upload`, `analytics:view` |
| `ad_manager` | Managing **Insaf Computer** promotional campaigns & placement slots | `ads:manage`, `analytics:view` |
| `analyst` | Read-only access to visitor traffic, deadline trends, and audit logs | `analytics:view`, `audit:read` |

### 2.2 Compliant Automated Job Collection & Source Tracking
- Tracked sources are registered in `public.job_sources` with `official_domain`, `poll_interval_minutes` (`>= 15`), and `robots_txt_verified`.
- Before fetching any URL, `workers/insaf_worker/compliance.py` verifies:
  1. The domain belongs to an approved public institutional suffix (`.gov.bd`, `.org.bd`, `.edu.bd`, `.ac.bd`, `.mil.bd`) or explicit admin allowlist.
  2. `robots.txt` explicitly permits `InsafJobCircularBot/1.0`.
  3. Polite crawl delay (`WORKER_MIN_REQUEST_DELAY_SECONDS >= 5`) is respected.
- Websites with restrictive Terms of Service, login walls, or anti-bot blocks are **never** scraped.

### 2.3 AI-Based Job Information Extraction
- Official job notices in Bangladesh are predominantly published as multi-page PDF circulars or scanned Bengali images.
- `workers/insaf_worker/extractor.py` processes raw PDF/image files from Supabase Storage (`job-notices` bucket) and extracts structured bilingual fields:
  - `title_en`, `title_bn`, `organization_name`, `vacancy_count`, `salary_range_text`, `educational_requirements`, `experience_requirements`, `age_limit_text`, `application_fee_text`, `application_start_at`, `application_deadline_at`, and `application_url`.
- Produces a calibrated `ai_confidence_score` (`0.000` – `1.000`).

### 2.4 Three-Layer Duplicate Job Detection
To guarantee zero duplicate circulars even when multiple portals reference the same government recruitment notice:
1. **Layer 1 — Exact File Hash (`file_sha256`)**: Every PDF or image notice has its SHA-256 digest computed (`UNIQUE (file_sha256)` on `public.job_notices`).
2. **Layer 2 — Canonical Job Fingerprint (`canonical_fingerprint`)**: Deterministic `SHA-256(normalized_org | normalized_title | deadline_YYYY_MM_DD | vacancy_count)` stored as `UNIQUE` on `public.jobs`.
3. **Layer 3 — Trigram Similarity (`pg_trgm`)**: GIN trigram index (`idx_jobs_title_trgm`) detects near-duplicate titles within the same organization and active deadline window, logging matches to `public.duplicate_reports`.

### 2.5 Official Notice Verification & Automatic Publishing Rules
Implemented in `src/features/verification/rules/auto-publish.rules.ts` and `workers/insaf_worker/verifier.py`:
- A job circular is **automatically published** (`verification_status = 'published'`, `auto_published = true`) **if and only if**:
  1. `isOfficialTrustedDomain === true` (e.g., verified `.gov.bd` / institutional HTTPS origin).
  2. `hasPrimaryNoticeAsset === true` and `noticeChecksumVerified === true`.
  3. `aiConfidenceScore >= 0.92`.
  4. `isDuplicateDetected === false`.
  5. `applicationDeadlineAt > NOW()`.
- If any criterion is not met, the circular safely enters `pending_verification` for one-click review by a `verifier_admin` or `super_admin`.

### 2.6 PDF & Image Notice Management
- Stored in Supabase Storage bucket `job-notices` using deterministic, collision-free object paths:
  `{year}/{organization_slug}/{job_slug}-{sha256_prefix}.{ext}`
- Served with CDN caching and in-app PDF/Image zoom preview so candidates can always verify the original circular before applying.

### 2.7 Deadline Tracking & Push Notifications (FCM)
- All deadlines are stored in `TIMESTAMPTZ` and formatted in `Asia/Dhaka` (`UTC+6`).
- Scheduled worker tasks scan active jobs approaching 72h / 48h / 24h before deadline and dispatch Firebase Cloud Messaging (FCM) Web Push notifications to subscribers in `public.push_subscriptions`.
- Jobs whose `application_deadline_at` has passed automatically transition to `expired`.

### 2.8 Insaf Computer Advertising Management & Visitor Analytics
- Dedicated `public.insaf_ad_campaigns` table and `src/features/ads/` module manage first-party promotional banners for **Insaf Computer** (online job application assistance, CV/photo formatting, printing).
- Supports five placement slots: `hero_banner`, `job_detail_sidebar`, `notice_viewer_footer`, `deadline_alert_card`, and `mobile_sticky_bar`.
- `public.analytics_events` records privacy-preserving metrics (`job_view`, `notice_pdf_download`, `apply_link_click`, `insaf_ad_impression`, `insaf_ad_click`, `pwa_install`) without storing invasive personal identifiers.

---

## 3. Security Architecture Summary

1. **Zero Frontend Secret Exposure**: `src/config/env.config.ts` throws a runtime violation if `getServerEnv()` is ever imported into browser code. Only `NEXT_PUBLIC_*` variables reach the client bundle.
2. **Row Level Security (RLS)**: Enabled on all 11 PostgreSQL tables (`0003_rls_policies_and_indexes.sql`). Anonymous users can only `SELECT` published jobs, verified notices, organizations, and active ads.
3. **API Input Validation**: Every API route validates query parameters and JSON bodies using `zod` schemas before executing business logic.
4. **Rate Limiting**: `src/lib/security/rate-limit.ts` enforces sliding-window rate limits (`60 RPM` public, `120 RPM` authenticated admin) and attaches `X-RateLimit-*` headers.
5. **Authenticated Worker Webhooks**: Python workers sign payloads with `HMAC-SHA256` (`X-Insaf-Worker-Signature`) verified via constant-time `timingSafeEqual` in `/api/v1/webhooks/worker`.
6. **Immutable Audit Logging**: Every administrative mutation writes a structured record to `public.audit_logs`.
