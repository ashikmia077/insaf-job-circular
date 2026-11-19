"""
Official Source & Notice Verifier Blueprint (`verifier.py`).

Evaluates whether an extracted job circular meets all cryptographic and domain
requirements for automatic publishing or requires human admin review.
"""

import hashlib
import hmac
from .compliance import is_domain_on_allowlist


AUTO_PUBLISH_MIN_CONFIDENCE = 0.92


def verify_and_decide_auto_publish(
    source_url: str,
    file_sha256: str,
    ai_confidence_score: float,
    is_duplicate: bool,
) -> dict[str, object]:
    """Evaluates auto-publish eligibility for an ingested job circular."""
    if is_duplicate:
        return {
            "eligible": False,
            "status": "rejected_duplicate",
            "reason": "Duplicate canonical fingerprint or notice SHA-256 detected.",
        }

    trusted_domain = is_domain_on_allowlist(source_url)
    valid_hash = len(file_sha256) == 64

    if trusted_domain and valid_hash and ai_confidence_score >= AUTO_PUBLISH_MIN_CONFIDENCE:
        return {
            "eligible": True,
            "status": "published",
            "reason": "Verified official domain, valid notice hash, and high AI confidence.",
        }

    return {
        "eligible": False,
        "status": "pending_verification",
        "reason": "Queued for human verifier_admin review.",
    }


def sign_webhook_payload(raw_json_body: str, secret: str) -> str:
    """Computes HMAC-SHA256 signature for Next.js `/api/v1/webhooks/worker`."""
    return hmac.new(
        secret.encode("utf-8"),
        raw_json_body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
