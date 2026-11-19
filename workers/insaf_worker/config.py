"""Worker runtime configuration loaded strictly from environment variables."""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class WorkerConfig:
    redis_url: str
    nextjs_webhook_url: str
    worker_webhook_secret: str
    ai_provider: str
    ai_model: str
    user_agent: str
    respect_robots_txt: bool
    min_request_delay_seconds: int

    @classmethod
    def from_env(cls) -> "WorkerConfig":
        return cls(
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            nextjs_webhook_url=os.getenv(
                "NEXTJS_WEBHOOK_URL", "http://localhost:3000/api/v1/webhooks/worker"
            ),
            worker_webhook_secret=os.getenv("WORKER_WEBHOOK_SECRET", ""),
            ai_provider=os.getenv("AI_EXTRACTION_PROVIDER", "gemini"),
            ai_model=os.getenv("AI_EXTRACTION_MODEL", "gemini-2.5-flash"),
            user_agent=os.getenv(
                "WORKER_USER_AGENT",
                "InsafJobCircularBot/1.0 (+https://insafjobcircular.com/bot-policy)",
            ),
            respect_robots_txt=os.getenv("WORKER_RESPECT_ROBOTS_TXT", "true").lower()
            == "true",
            min_request_delay_seconds=max(
                5, int(os.getenv("WORKER_MIN_REQUEST_DELAY_SECONDS", "5"))
            ),
        )
