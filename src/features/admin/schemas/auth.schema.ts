import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Valid administrator email is required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must not exceed 128 characters."),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Valid administrator email is required."),
});

export const passwordUpdateSchema = z
  .object({
    password: z
      .string()
      .min(10, "New password must be at least 10 characters.")
      .max(128)
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
