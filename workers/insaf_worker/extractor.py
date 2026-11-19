"""
AI Structured Job Extraction Blueprint (`extractor.py`).

Defines the structured extraction schema and interface used in Phase 2+
to parse official PDF/image job circulars into validated fields.
"""

from dataclasses import dataclass, field


@dataclass
class ExtractedJobCircular:
    organization_name_en: str
    title_en: str
    category: str
    application_deadline_at: str
    official_source_url: str
    ai_confidence_score: float
    organization_name_bn: str | None = None
    title_bn: str | None = None
    vacancy_count: int | None = None
    educational_requirements: str | None = None
    experience_requirements: str | None = None
    age_limit_text: str | None = None
    application_fee_text: str | None = None
    application_url: str | None = None
    warnings: list[str] = field(default_factory=list)
