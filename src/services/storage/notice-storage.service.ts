import { getServerEnv } from "@/config/env.config";
import type { NoticeFileType } from "@/types/database.types";

export interface NoticeStorageDescriptor {
  bucket: string;
  objectPath: string;
  fileType: NoticeFileType;
  maxBytes: number;
  allowedMimeTypes: readonly string[];
}

const PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Builds deterministic, collision-safe storage paths for official PDF and Image notices
 * stored in Supabase Storage.
 */
export function buildNoticeStorageDescriptor(params: {
  year: number;
  organizationSlug: string;
  jobSlug: string;
  fileSha256: string;
  fileType: NoticeFileType;
  extension: "pdf" | "png" | "jpg" | "webp";
}): NoticeStorageDescriptor {
  const env = getServerEnv();
  const shortHash = params.fileSha256.slice(0, 12);
  const objectPath = `${params.year}/${params.organizationSlug}/${params.jobSlug}-${shortHash}.${params.extension}`;

  return {
    bucket: env.SUPABASE_BUCKET_NOTICES,
    objectPath,
    fileType: params.fileType,
    maxBytes: params.fileType === "pdf" ? PDF_MAX_BYTES : IMAGE_MAX_BYTES,
    allowedMimeTypes:
      params.fileType === "pdf"
        ? ["application/pdf"]
        : ["image/jpeg", "image/png", "image/webp"],
  };
}
