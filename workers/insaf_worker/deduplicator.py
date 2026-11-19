"""
Deduplication Engine (`deduplicator.py`).

Computes deterministic SHA-256 file checksums and canonical job fingerprints
to prevent duplicate circulars across multiple sources.
"""

import hashlib
import re


def compute_bytes_sha256(content: bytes) -> str:
    """Returns hex SHA-256 digest of a raw PDF or image notice."""
    return hashlib.sha256(content).hexdigest()


def normalize_text(text: str) -> str:
    """Normalizes whitespace and case for deterministic fingerprinting."""
    collapsed = re.sub(r"\s+", " ", text.strip().lower())
    return collapsed


def compute_canonical_job_fingerprint(
    organization_name: str,
    job_title: str,
    application_deadline_date: str,
    vacancy_count: int | None = None,
) -> str:
    """
    Produces a 64-character SHA-256 canonical fingerprint from key job attributes.
    """
    canonical_parts = [
        normalize_text(organization_name),
        normalize_text(job_title),
        application_deadline_date.strip()[:10],
        str(vacancy_count or 0),
    ]
    joined = "|".join(canonical_parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()
