# API & Background Worker Contracts

## 1. REST API Envelope (`src/types/api.types.ts`)

All Next.js API endpoints under `/api/*` return a deterministic JSON envelope:

### Success Response
```json
{
  "success": true,
  "data": {},
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  },
  "meta": {
    "requestId": "c3f4e1b2-...",
    "timestamp": "2026-11-19T04:00:00.000Z",
    "rateLimit": {
      "limit": 60,
      "remaining": 59,
      "resetAtEpochMs": 1795060860000
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid job circular payload.",
    "details": {}
  },
  "meta": {
    "requestId": "9a8b7c6d-...",
    "timestamp": "2026-11-19T04:00:00.000Z"
  }
}
```

---

## 2. Python Worker -> Next.js Webhook Authentication

- **Endpoint**: `POST /api/v1/webhooks/worker`
- **Header**: `X-Insaf-Worker-Signature: <hex_hmac_sha256>`
- **Computation**: `HMAC_SHA256(WORKER_WEBHOOK_SECRET, raw_request_body)`
- **Verification**: Verified in `src/app/api/v1/webhooks/worker/route.ts` using Node's `crypto.timingSafeEqual` to prevent timing side-channel attacks.

---

## 3. Redis Queue Topics (`src/types/worker.types.ts`)

| Queue Topic | Producer | Consumer | Purpose |
| :--- | :--- | :--- | :--- |
| `queue:job:collect` | Scheduler / Admin | Python Collector | Poll a compliant `job_sources` feed |
| `queue:job:extract_ai` | Python Collector | Python AI Extractor | Run OCR + bilingual structured extraction on notice PDF/image |
| `queue:job:deduplicate` | Python AI Extractor | Python Deduplicator | Check `file_sha256`, `canonical_fingerprint`, and trigram similarity |
| `queue:job:verify_source` | Python Deduplicator | Python Verifier | Evaluate auto-publish rules and notify Next.js webhook |
| `queue:notification:dispatch` | Next.js / Scheduler | Notification Worker | Send FCM push notifications for new verified jobs & 48h deadlines |
