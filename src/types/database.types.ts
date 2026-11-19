import type { AdminRole, CanonicalAdminRole } from "@/config/permissions.config";

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

export type SourceScanStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SourceLinkStatus =
  | "discovered"
  | "fetched"
  | "extracted"
  | "duplicate"
  | "failed"
  | "blocked_robots";

export type JobUpdateType =
  | "corrigendum"
  | "deadline_extension"
  | "vacancy_revision"
  | "notice_replacement"
  | "editorial_correction"
  | "status_change";

export type NotificationType =
  | "new_verified_job"
  | "deadline_reminder"
  | "job_update"
  | "system_alert";

export type NotificationDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "read";

export type ReportType =
  | "incorrect_deadline"
  | "broken_apply_link"
  | "fake_or_scam_circular"
  | "duplicate_job"
  | "notice_unreadable"
  | "other";

export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";

// 1. admin_profiles
export interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  created_by_admin_id: string | null;
  last_active_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 2. profiles
export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  preferred_categories: JobCategory[];
  email_alerts_enabled: boolean;
  push_alerts_enabled: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 3. job_categories
export interface JobCategoryRecord {
  id: string;
  slug: string;
  category_enum: JobCategory;
  name_en: string;
  name_bn: string;
  description_en: string | null;
  description_bn: string | null;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 4. organizations
export interface Organization {
  id: string;
  name_en: string;
  name_bn: string | null;
  slug: string;
  category: JobCategory;
  category_id: string | null;
  official_domain: string | null;
  website_url: string | null;
  is_trusted_government_domain: boolean;
  is_verified_organization: boolean;
  logo_storage_path: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 5. job_sources
export interface JobSourceRecord {
  id: string;
  organization_id: string | null;
  source_name: string;
  source_url: string;
  official_domain: string;
  robots_txt_verified: boolean;
  is_enabled: boolean;
  poll_interval_minutes: number;
  failure_count: number;
  last_error_message: string | null;
  last_polled_at: string | null;
  created_by_admin_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 6. source_scans
export interface SourceScanRecord {
  id: string;
  source_id: string;
  triggered_by_admin_id: string | null;
  scan_status: SourceScanStatus;
  links_discovered: number;
  new_jobs_ingested: number;
  duplicates_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// 7. job_source_links
export interface JobSourceLinkRecord {
  id: string;
  source_id: string;
  scan_id: string | null;
  job_id: string | null;
  discovered_url: string;
  canonical_url_hash: string;
  link_status: SourceLinkStatus;
  http_status_code: number | null;
  content_sha256: string | null;
  error_message: string | null;
  first_seen_at: string;
  last_checked_at: string;
  created_at: string;
}

// 8. jobs
export interface JobCircularRecord {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  organization_id: string;
  source_id: string | null;
  category: JobCategory;
  category_id: string | null;
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
  is_featured: boolean;
  created_by_admin_id: string | null;
  verified_by_admin_id: string | null;
  verified_at: string | null;
  published_at: string | null;
  views_count: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 9. job_notices
export interface OfficialNoticeAsset {
  id: string;
  job_id: string;
  file_type: NoticeFileType;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string;
  storage_path: string;
  file_sha256: string;
  page_count: number;
  ocr_raw_text: string | null;
  is_primary_notice: boolean;
  verified_authentic: boolean;
  uploaded_by_admin_id: string | null;
  verified_by_admin_id: string | null;
  verified_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 10. job_verifications
export interface JobVerificationRecord {
  id: string;
  job_id: string;
  reviewer_admin_id: string | null;
  is_automated_check: boolean;
  previous_status: JobVerificationStatus;
  new_status: JobVerificationStatus;
  domain_verified: boolean;
  checksum_verified: boolean;
  notes: string | null;
  created_at: string;
}

// 11. job_updates
export interface JobUpdateRecord {
  id: string;
  job_id: string;
  update_type: JobUpdateType;
  summary_en: string;
  summary_bn: string | null;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  notice_id: string | null;
  created_by_admin_id: string | null;
  created_at: string;
}

// 12. duplicate_reports
export interface DuplicateReportRecord {
  id: string;
  primary_job_id: string;
  duplicate_source_url: string;
  matched_fingerprint: string | null;
  matched_notice_sha256: string | null;
  similarity_score: number;
  detected_at: string;
}

// 13. saved_jobs
export interface SavedJobRecord {
  id: string;
  profile_id: string;
  job_id: string;
  notes: string | null;
  deadline_reminder_sent: boolean;
  created_at: string;
}

// 14. notifications
export interface NotificationRecord {
  id: string;
  recipient_profile_id: string | null;
  job_id: string | null;
  notification_type: NotificationType;
  title_en: string;
  title_bn: string | null;
  body_en: string;
  body_bn: string | null;
  target_url: string;
  delivery_status: NotificationDeliveryStatus;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// 15. push_subscriptions
export interface PushSubscriptionRecord {
  id: string;
  fcm_token: string;
  subscribed_categories: JobCategory[];
  deadline_reminders_enabled: boolean;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 16. insaf_ad_campaigns
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
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 17. analytics_events
export interface AnalyticsEventRecord {
  id: string;
  event_type: string;
  job_id: string | null;
  ad_campaign_id: string | null;
  session_id: string | null;
  device_type: string;
  referrer_domain: string | null;
  created_at: string;
}

// 18. visitor_sessions
export interface VisitorSessionRecord {
  id: string;
  session_hash: string;
  device_type: string;
  country_code: string;
  entry_path: string;
  referrer_domain: string | null;
  page_views_count: number;
  started_at: string;
  last_seen_at: string;
}

// 19. reports
export interface ReportRecord {
  id: string;
  job_id: string | null;
  reporter_profile_id: string | null;
  reporter_email: string | null;
  report_type: ReportType;
  description: string;
  status: ReportStatus;
  resolved_by_admin_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 20. audit_logs (Requirement 5: Admin ID, Action, Resource, Previous State, New State, Timestamp)
export interface AuditLogRecord {
  id: string;
  actor_admin_id: string | null;
  actor_role: CanonicalAdminRole | AdminRole | "system_worker";
  action: string;
  resource: string;
  entity_type: string;
  entity_id: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
