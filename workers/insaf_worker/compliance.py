"""
Compliance & Legal Source Guard (`compliance.py`).

Enforces Security Requirement:
'Never scrape websites in violation of their terms or access restrictions.'
"""

from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser


TRUSTED_PUBLIC_SUFFIXES = (
    ".gov.bd",
    ".org.bd",
    ".edu.bd",
    ".ac.bd",
    ".mil.bd",
)


def is_domain_on_allowlist(url: str, explicit_allowlist: set[str] | None = None) -> bool:
    """Checks if a target URL belongs to an approved public institutional domain."""
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        return False

    hostname = parsed.hostname.lower()
    if explicit_allowlist and hostname in explicit_allowlist:
        return True

    return any(hostname.endswith(suffix) for suffix in TRUSTED_PUBLIC_SUFFIXES)


def is_allowed_by_robots_txt(url: str, user_agent: str) -> bool:
    """Verifies via standard `robots.txt` rules that automated fetching is permitted."""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return False

    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception:
        # Fail-closed when robots.txt cannot be verified
        return False
