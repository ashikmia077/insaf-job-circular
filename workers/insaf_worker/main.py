"""
Entrypoint for the Insaf Job Circular Python Background Worker (`main.py`).
Phase 1: Validates configuration and module readiness without executing live network scrapes.
"""

from .config import WorkerConfig
from .deduplicator import compute_canonical_job_fingerprint


def run_self_check() -> dict[str, object]:
    config = WorkerConfig.from_env()
    sample_fingerprint = compute_canonical_job_fingerprint(
        organization_name="Bangladesh Public Service Commission (BPSC)",
        job_title="Non-Cadre Assistant Engineer",
        application_deadline_date="2026-12-31",
        vacancy_count=45,
    )
    return {
        "worker_version": "0.1.0",
        "phase": "phase-1-architecture",
        "respect_robots_txt": config.respect_robots_txt,
        "min_request_delay_seconds": config.min_request_delay_seconds,
        "sample_fingerprint_ok": len(sample_fingerprint) == 64,
    }


if __name__ == "__main__":
    status = run_self_check()
    print("Insaf Worker Phase 1 Self-Check:", status)
