# Development Roadmap — Insaf Job Circular

This roadmap breaks down the engineering lifecycle of **Insaf Job Circular** into controlled, reviewable phases.

---

## Phase 1 — Production Architecture & Project Initialization ✅ *(Current — Completed)*
- [x] System architecture design (`ARCHITECTURE.md`).
- [x] Next.js 14 (App Router) + TypeScript (`strict`) initialization.
- [x] Tailwind CSS + `shadcn/ui` + `lucide-react` + `framer-motion` integration.
- [x] Environment variable template (`.env.example` & `workers/.env.example`) with strict server/client separation (`src/config/env.config.ts`).
- [x] Scalable modular feature structure (`jobs`, `notices`, `verification`, `admin`, `analytics`, `ads`).
- [x] Supabase PostgreSQL migration blueprints (`database/migrations/0001..0003`) including 11 tables, enums, indexes, and RLS policies.
- [x] RBAC permission matrix, rate-limiting architecture, and audit log contracts.
- [x] Python automation worker package (`workers/insaf_worker/`) with `robots.txt` compliance guard, SHA-256 deduplicator, AI extractor schema, and HMAC verifier.
- [x] PWA manifest (`public/manifest.json`) and Service Worker scaffold (`public/sw.js`).
- [x] Lint, TypeScript typecheck, and production build verification.

---

## Phase 2 — Database Provisioning, Authentication & Multi-Admin Governance ✅ *(Current — Completed)*
- [x] Complete 20-table PostgreSQL relational schema (`database/migrations/0004_phase2_schema_extensions_and_tables.sql`).
- [x] Database-level RLS policies, `SUPER_ADMIN` / `EDITOR_ADMIN` / `VERIFICATION_ADMIN` role normalization, `EDITOR_ADMIN` publish block trigger, and immutable `audit_logs` trigger (`database/migrations/0005_phase2_rls_triggers_and_audit_protection.sql`).
- [x] Supabase browser, server, admin, and middleware clients + route protection (`src/middleware.ts`, `src/lib/supabase/*`).
- [x] Admin authentication API & pages (`/admin/login`, `/admin/reset-password`, `/admin/update-password`, `/admin`) with authentication rate limiting (`RATE_LIMIT_AUTH_RPM`).
- [x] 7 Modular Domain Services (`JobsService`, `CategoriesService`, `OrganizationsService`, `NoticesService`, `SourcesService`, `VerificationService`, `AdminsService`) with automatic `previous_state` / `new_state` audit logging.
- [x] Automated Vitest + embedded PostgreSQL (`@electric-sql/pglite`) test suite (`tests/phase2.governance.test.ts`).

---

## Phase 3 — Core Job Circular Portal, Notice Viewer & Insaf Computer Ad Slots *(Pending Approval)*
- [ ] Responsive Bengali/English Job Circular feed with category tabs, search, and active deadline countdown badges.
- [ ] Job Detail page with structured eligibility tables, application fee breakdown, and official source attribution.
- [ ] Embedded PDF & high-resolution Image Notice Viewer with SHA-256 authenticity badge and direct download.
- [ ] First-party **Insaf Computer** dynamic ad slot renderer (`hero_banner`, `job_detail_sidebar`, `notice_viewer_footer`, `mobile_sticky_bar`).

---

## Phase 4 — Admin Verification Workbench & Manual Publishing Flow *(Pending Approval)*
- [ ] Admin Dashboard with queue tabs (`pending_verification`, `published`, `rejected_duplicate`, `expired`).
- [ ] Side-by-side Verification Workbench: Original PDF/Image notice on the left, AI-extracted editable fields on the right.
- [ ] One-click **Verify & Publish**, **Reject Duplicate**, and **Manual Notice Upload** workflows with automatic audit logging.
- [ ] Insaf Computer Ad Campaign Manager UI.

---

## Phase 5 — Python Automation Engine, AI Extraction & Deduplication Runtime *(Pending Approval)*
- [ ] Connect Upstash/Redis queue between Next.js and Python workers.
- [ ] Implement live compliant polling for approved `.gov.bd` / institutional feeds in `workers/insaf_worker/collector.py`.
- [ ] Integrate OCR + LLM structured extraction in `workers/insaf_worker/extractor.py`.
- [ ] Activate 3-layer deduplication and deterministic auto-publish webhook pipeline.

---

## Phase 6 — PWA Push Notifications, Analytics & Production Hardening *(Pending Approval)*
- [ ] Connect Firebase Cloud Messaging (FCM) Web Push subscription UI and category topic selection.
- [ ] Automated 48-hour deadline reminder worker job.
- [ ] Privacy-preserving visitor & ad analytics dashboard for `analyst` and `super_admin` roles.
- [ ] End-to-end security audit, load testing, and approved deployment to Vercel + Worker host.
