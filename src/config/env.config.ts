import { z } from "zod";

const optionalUrl = z
  .preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().url().optional()
  );

const optionalNonEmptyString = z
  .preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().min(1).optional()
  );

/**
 * Client-safe environment schema (NEXT_PUBLIC_*)
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Insaf Job Circular"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalNonEmptyString,
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: optionalNonEmptyString,
});

/**
 * Server-only environment schema.
 * Never imported into client components.
 */
const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  SUPABASE_BUCKET_NOTICES: z.string().default("job-notices"),
  SUPABASE_BUCKET_LOGOS: z.string().default("organization-logos"),
  SUPABASE_BUCKET_ADS: z.string().default("insaf-ad-creatives"),
  REDIS_URL: optionalNonEmptyString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString,
  FIREBASE_CLIENT_EMAIL: optionalNonEmptyString,
  FIREBASE_PRIVATE_KEY: optionalNonEmptyString,
  WORKER_WEBHOOK_SECRET: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.string().min(16).optional()
    ),
  AI_EXTRACTION_PROVIDER: z.string().default("gemini"),
  AI_EXTRACTION_API_KEY: optionalNonEmptyString,
  AI_EXTRACTION_MODEL: z.string().default("gemini-2.5-flash"),
  RATE_LIMIT_PUBLIC_RPM: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_ADMIN_RPM: z.coerce.number().int().positive().default(120),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
});

export function getClientEnv() {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: getServerEnv() must never be executed in browser code."
    );
  }
  return serverEnvSchema.parse(process.env);
}
