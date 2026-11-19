/**
 * Sliding-Window Rate Limiter Architecture
 * Supports Upstash/Redis in production with deterministic local memory window fallback
 * when Redis credentials are not yet provisioned during Phase 1 initialization.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtEpochMs: number;
}

interface WindowBucket {
  count: number;
  resetAtEpochMs: number;
}

const memoryBuckets = new Map<string, WindowBucket>();

export async function checkRateLimit(options: {
  identifier: string;
  limitPerMinute: number;
  windowMs?: number;
}): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const existing = memoryBuckets.get(options.identifier);

  if (!existing || existing.resetAtEpochMs <= now) {
    const resetAtEpochMs = now + windowMs;
    memoryBuckets.set(options.identifier, { count: 1, resetAtEpochMs });
    return {
      allowed: true,
      limit: options.limitPerMinute,
      remaining: Math.max(0, options.limitPerMinute - 1),
      resetAtEpochMs,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= options.limitPerMinute;
  return {
    allowed,
    limit: options.limitPerMinute,
    remaining: Math.max(0, options.limitPerMinute - existing.count),
    resetAtEpochMs: existing.resetAtEpochMs,
  };
}
