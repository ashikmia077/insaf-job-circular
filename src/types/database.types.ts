import type { AdminRole } from "@/config/permissions.config";

export type JobCategory =
  | "government"
  | "bank"
  | "autonomous"
  | "defense"
  | "ngo"
  | "private"
  | "education";

export type JobVerificationStatus =
  | "ingested_raw"
  | "ai_extracted"
  | "pending_verification"
  | "verified_official"
  | "rejected_duplicate"
  | "rejected_unverified"
  | "published"
  | "expired";

export type NoticeFileType = "pdf" | "image";

export type AdPlacementSlot =
  | "hero_banner"
  | "job_detail_sidebar"
  | "notice_viewer_footer"
  | "deadline_alert_card"
  | "mobile_sticky_bar";

export interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name_en: string;
  name_bn: string | null;
  slug: string;
  category: JobCategory;
  official_domain: string | null;
  is_trusted_government_domain: boolean;
  logo_storage_path: string | null;
  created_at: string;
}

export interface JobCircularRecord {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  organization_id: string;
  category: JobCategory;
  vacancy_count: number | null;
  salary_range_text: string | null;
  educational_requirements: string | null;
  experience_requirements: string | null;
  age_limit_text: string | null;
  application_fee_text: string | null;
  application_url: string | null;
  official_source_url: string;
  published_on_source_at: string | null;
  application_start_at: string | null;
  application_deadline_at: string;
  verification_status: JobVerificationStatus;
  ai_confidence_score: number | null;
  canonical_fingerprint: string;
  auto_published: boolean;
  verified_by_admin_id: string | null;
  verified_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfficialNoticeAsset {
  id: string;
  job_id: string;
  file_type: NoticeFileType;
  storage_bucket: string;
  storage_path: string;
  file_sha256: string;
  page_count: number;
  ocr_raw_text: string | null;
  is_primary_notice: boolean;
  verified_authentic: boolean;
  created_at: string;
}

export interface InsafAdCampaign {
  id: string;
  campaign_name: string;
  headline_bn: string;
  headline_en: string;
  cta_text: string;
  destination_url: string;
  contact_phone: string | null;
  placement_slot: AdPlacementSlot;
  creative_storage_path: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  impressions_count: number;
  clicks_count: number;
  created_by_admin_id: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_admin_id: string | null;
  actor_role: AdminRole | "system_worker";
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
