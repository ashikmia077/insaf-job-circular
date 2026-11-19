import { z } from "zod";

export const adPlacementSlotSchema = z.enum([
  "hero_banner",
  "job_detail_sidebar",
  "notice_viewer_footer",
  "deadline_alert_card",
  "mobile_sticky_bar",
]);

export const insafAdCampaignSchema = z.object({
  campaignName: z.string().trim().min(3).max(120),
  headlineBn: z.string().trim().min(3).max(180),
  headlineEn: z.string().trim().min(3).max(180),
  ctaText: z.string().trim().min(2).max(60),
  destinationUrl: z.string().url(),
  contactPhone: z.string().trim().max(30).optional(),
  placementSlot: adPlacementSlotSchema,
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});

export type InsafAdCampaignInput = z.infer<typeof insafAdCampaignSchema>;
