import type { JobCategory, NoticeFileType } from "@/types/database.types";

export type WorkerQueueTopic =
  | "queue:job:collect"
  | "queue:job:extract_ai"
  | "queue:job:deduplicate"
  | "queue:job:verify_source"
  | "queue:notification:dispatch";

export interface WorkerExtractedJobPayload {
  sourceId: string;
  sourceUrl: string;
  organizationNameEn: string;
  organizationNameBn?: string;
  officialDomain?: string;
  titleEn: string;
  titleBn?: string;
  category: JobCategory;
  vacancyCount?: number;
  applicationStartAt?: string;
  applicationDeadlineAt: string;
  applicationUrl?: string;
  noticeAssets: Array<{
    fileType: NoticeFileType;
    sourceFileUrl: string;
    sha256Checksum: string;
    pageCount: number;
  }>;
  aiConfidenceScore: number;
  canonicalFingerprint: string;
  extractedAtIso: string;
}
