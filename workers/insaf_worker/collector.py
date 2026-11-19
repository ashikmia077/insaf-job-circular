"""
Authorized Source Collector Blueprint (`collector.py`).
"""

from dataclasses import dataclass
from .compliance import is_allowed_by_robots_txt, is_domain_on_allowlist


@dataclass(frozen=True)
class JobSourceDescriptor:
    source_id: str
    name: str
    feed_url: str
    official_domain: str


def validate_source_before_collection(
    source: JobSourceDescriptor,
    user_agent: str,
    explicit_allowlist: set[str] | None = None,
    check_robots: bool = True,
) -> tuple[bool, str]:
    """Validates that a source is both on the domain allowlist and permits crawling."""
    if not is_domain_on_allowlist(source.feed_url, explicit_allowlist):
        return False, f"Domain not in approved allowlist: {source.feed_url}"

    if check_robots and not is_allowed_by_robots_txt(source.feed_url, user_agent):
        return False, f"Disallowed by robots.txt for {source.feed_url}"

    return True, "Source validated for compliant collection."
