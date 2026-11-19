import { z } from "zod";
import { ADMIN_ROLES } from "@/config/permissions.config";

export const adminReviewDecisionSchema = z.object({
  jobId: z.string().uuid(),
  decision: z.enum(["approve_and_publish", "reject_duplicate", "reject_unverified"]),
  reviewNotes: z.string().trim().min(3).max(1000),
  triggerPushNotification: z.boolean().default(true),
});

export const assignAdminRoleSchema = z.object({
  targetAdminId: z.string().uuid(),
  role: z.enum(ADMIN_ROLES),
  reason: z.string().trim().min(5).max(500),
});

export type AdminReviewDecisionInput = z.infer<typeof adminReviewDecisionSchema>;
export type AssignAdminRoleInput = z.infer<typeof assignAdminRoleSchema>;
