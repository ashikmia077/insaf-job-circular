# Insaf Job Circular (ইনসাফ জব সার্কুলার)

**Insaf Job Circular** is a production-grade Bangladesh Job Circular Web Application and Progressive Web App (PWA) designed to collect, verify, organize, and publish authentic Government, Bank, Autonomous, Defense, NGO, Private, and Education job circulars with official PDF/image notices, deadline tracking, push notifications, and first-party **Insaf Computer** digital service promotions.

> **Current Project Status:** **Phase 1 — Production Architecture & Project Initialization (Completed on branch `dev`)**  
> Awaiting architecture review and approval before proceeding to Phase 2 (Database & Auth Integration).

---

## 1. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Platform** | Responsive Web Application + Installable PWA (`manifest.json` + `sw.js`) |
| **Frontend Framework** | Next.js 14.2.35 (App Router) + TypeScript 5 (`strict: true`) |
| **Styling & UI** | Tailwind CSS 3.4 + `shadcn/ui` + `lucide-react` + `framer-motion` |
| **Backend API** | Next.js Route Handlers (`src/app/api/v1/*`) + Zod Validation |
| **Database & Auth** | Supabase PostgreSQL + Supabase Auth + Row Level Security (RLS) |
| **Object Storage** | Supabase Storage (`job-notices`, `organization-logos`, `insaf-ad-creatives`) |
| **Automation Workers** | Python 3.11+ (`workers/insaf_worker`) |
| **Queue & Rate Limiting** | Redis / Upstash Redis |
| **Push Notifications** | Firebase Cloud Messaging (FCM) |
| **Hosting Target** | Vercel (Web + API) + Separate Worker Host (Docker / Railway / Fly.io) |

---

## 2. Project Directory Structure

```text
insaf-job-circular/
├── .env.example                          # Environment variable template (no secrets)
├── .eslintrc.json                        # ESLint Next.js + TypeScript strict rules
├── ARCHITECTURE.md                       # Complete system architecture blueprint
├── DEVELOPMENT_ROADMAP.md                # Phased engineering & delivery roadmap
├── README.md                             # Setup & project overview
├── components.json                       # shadcn/ui configuration
├── next.config.mjs                       # Next.js security headers & image host config
├── package.json                          # Node.js dependencies & scripts
├── postcss.config.mjs                    # PostCSS configuration
├── tailwind.config.ts                    # Tailwind CSS + shadcn theme tokens
├── tsconfig.json                         # Strict TypeScript configuration
├── database/
│   └── migrations/
│       ├── 0001_initial_enums_and_extensions.sql
│       ├── 0002_core_tables.sql
│       ├── 0003_rls_policies_and_indexes.sql
│       └── README.md
├── docs/
│   ├── API_AND_WORKER_CONTRACTS.md
│   └── SECURITY_AND_COMPLIANCE.md
├── public/
│   ├── icons/
│   │   └── icon.svg
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   └── v1/
│   │   │       ├── jobs/route.ts
│   │   │       └── webhooks/worker/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── architecture-shell.tsx
│   │   └── ui/
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── separator.tsx
│   ├── config/
│   │   ├── env.config.ts
│   │   ├── permissions.config.ts
│   │   └── site.config.ts
│   ├── features/
│   │   ├── admin/
│   │   ├── ads/
│   │   ├── analytics/
│   │   ├── jobs/
│   │   ├── notices/
│   │   └── verification/
│   ├── hooks/
│   │   ├── use-debounce.ts
│   │   └── use-pwa-install.ts
│   ├── lib/
│   │   ├── api/response.ts
│   │   ├── security/
│   │   │   ├── audit.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── rbac.ts
│   │   ├── supabase/
│   │   │   ├── admin.ts
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── utils.ts
│   ├── services/
│   │   ├── notifications/fcm.service.ts
│   │   ├── queue/redis-queue.service.ts
│   │   └── storage/notice-storage.service.ts
│   └── types/
│       ├── api.types.ts
│       ├── database.types.ts
│       └── worker.types.ts
└── workers/
    ├── .env.example
    ├── README.md
    ├── pyproject.toml
    ├── requirements.txt
    └── insaf_worker/
        ├── __init__.py
        ├── collector.py
        ├── compliance.py
        ├── config.py
        ├── deduplicator.py
        ├── extractor.py
        ├── main.py
        └── verifier.py
```

---

## 3. Local Development Setup

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **Python**: `>= 3.11` (for the background automation worker)
- **Git**

### Step 1: Clone & Checkout Development Branch
```bash
git clone https://github.com/ashikmia077/insaf-job-circular.git
cd insaf-job-circular
git checkout dev
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env.local
cp workers/.env.example workers/.env
```
Populate `.env.local` and `workers/.env` with your real Supabase, Redis, and Firebase credentials when moving to Phase 2.

### Step 3: Install Frontend/API Dependencies & Verify Build
```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

### Step 4: Verify Python Worker Package
```bash
cd workers
python3 -m insaf_worker.main
```

---

## 4. Key Architecture Documents
- [ARCHITECTURE.md](./ARCHITECTURE.md) — End-to-end system design, data flows, RBAC, verification & auto-publish rules.
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) — Step-by-step phased implementation plan.
- [docs/SECURITY_AND_COMPLIANCE.md](./docs/SECURITY_AND_COMPLIANCE.md) — Security controls, RLS policies, and legal scraping compliance.
- [docs/API_AND_WORKER_CONTRACTS.md](./docs/API_AND_WORKER_CONTRACTS.md) — REST API schemas, Redis queues, and HMAC webhook specifications.
