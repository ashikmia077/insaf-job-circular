import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { redisQueueService } from "@/services/queue/redis-queue.service";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `health:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_PUBLIC_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMIT_EXCEEDED", "Too many requests.", {
      status: 429,
      rateLimit,
    });
  }

  return apiSuccess(
    {
      service: "insaf-job-circular-api",
      phase: "phase-1-architecture",
      status: "healthy",
      subsystems: {
        supabaseConfigured: Boolean(
          env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        redisQueueConfigured: redisQueueService.isConfigured(),
        workerWebhookSecretConfigured: Boolean(env.WORKER_WEBHOOK_SECRET),
      },
    },
    { rateLimit }
  );
}
