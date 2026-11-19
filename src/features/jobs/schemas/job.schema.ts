import { z } from "zod";

export const jobCategorySchema = z.enum([
  "government",
  "bank",
  "autonomous",
  "defense",
  "ngo",
  "private",
  "education",
]);

export const jobFilterQuerySchema = z.object({
  category: jobCategorySchema.optional(),
  search: z.string().trim().max(120).optional(),
  onlyActiveDeadlines: z.coerce.boolean().default(true),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createJobCircularSchema = z.object({
  titleEn: z.string().trim().min(5).max(240),
  titleBn: z.string().trim().min(5).max(240).optional(),
  organizationId: z.string().uuid(),
  category: jobCategorySchema,
  vacancyCount: z.number().int().positive().nullable().optional(),
  salaryRangeText: z.string().trim().max(160).optional(),
  educationalRequirements: z.string().trim().max(2000).optional(),
  experienceRequirements: z.string().trim().max(1000).optional(),
  ageLimitText: z.string().trim().max(160).optional(),
  applicationFeeText: z.string().trim().max(160).optional(),
  applicationUrl: z.string().url().optional(),
  officialSourceUrl: z.string().url(),
  applicationStartAt: z.string().datetime().optional(),
  applicationDeadlineAt: z.string().datetime(),
});

export type JobFilterQuery = z.infer<typeof jobFilterQuerySchema>;
export type CreateJobCircularInput = z.infer<typeof createJobCircularSchema>;
