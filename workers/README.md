# Insaf Job Circular — Python Background Automation Worker (`workers/`)

This directory contains the standalone Python background worker package (`insaf_worker`) responsible for:

1. **Compliant Source Collection (`collector.py` & `compliance.py`)**
   - Polls only approved public government/institutional portals and RSS/JSON feeds.
   - Strictly checks `robots.txt` (`urllib.robotparser`), enforces domain allowlists, and respects `WORKER_MIN_REQUEST_DELAY_SECONDS`.
   - **Never** bypasses authentication walls, CAPTCHAs, or Terms of Service restrictions.

2. **AI Job Information Extraction (`extractor.py`)**
   - Extracts structured bilingual (Bengali + English) fields from official PDF and image notices:
     - Organization, Job Title, Vacancy Count, Educational/Experience Requirements, Age Limit, Application Fee, Start/Deadline timestamps, and Official Apply Link.
   - Computes an `ai_confidence_score` (`0.00` to `1.00`).

3. **Duplicate Job Detection (`deduplicator.py`)**
   - Multi-layer deduplication:
     - Layer 1: Exact file SHA-256 hash of the official PDF/image notice.
     - Layer 2: Canonical fingerprint (`SHA-256(normalized_org + normalized_title + deadline_date + vacancy_count)`).
     - Layer 3: Trigram/semantic similarity threshold prior to insertion.

4. **Official Notice Verification & Auto-Publish Evaluation (`verifier.py`)**
   - Verifies whether the notice originated from a `.gov.bd`, `.org.bd`, `.edu.bd`, or explicitly allowlisted institutional domain over HTTPS.
   - Dispatches HMAC-SHA256 signed webhooks (`X-Insaf-Worker-Signature`) to Next.js API (`/api/v1/webhooks/worker`).
