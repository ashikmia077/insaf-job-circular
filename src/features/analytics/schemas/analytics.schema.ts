import { z } from "zod";

export const analyticsEventSchema = z.object({
  eventType: z.enum([
    "job_view",
    "notice_pdf_download",
    "notice_image_zoom",
    "apply_link_click",
    "insaf_ad_impression",
    "insaf_ad_click",
    "pwa_install",
  ]),
  jobId: z.string().uuid().optional(),
  adCampaignId: z.string().uuid().optional(),
  referrerDomain: z.string().max(120).optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).default("mobile"),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
