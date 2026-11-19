import { z } from "zod";

export const officialNoticeSchema = z.object({
  jobId: z.string().uuid(),
  fileType: z.enum(["pdf", "image"]),
  storageBucket: z.string().min(1),
  storagePath: z.string().min(1),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid SHA-256 checksum"),
  pageCount: z.number().int().min(1).max(200).default(1),
  ocrRawText: z.string().optional(),
  isPrimaryNotice: z.boolean().default(true),
});

export type OfficialNoticeInput = z.infer<typeof officialNoticeSchema>;
