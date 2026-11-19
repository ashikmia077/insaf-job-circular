import { NextResponse } from "next/server";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  PaginationMeta,
} from "@/types/api.types";
import type { RateLimitResult } from "@/lib/security/rate-limit";

function buildHeaders(rateLimit?: RateLimitResult): HeadersInit {
  if (!rateLimit) return {};
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAtEpochMs),
  };
}

export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    pagination?: PaginationMeta;
    rateLimit?: RateLimitResult;
  }
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: options?.pagination,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        rateLimit: options?.rateLimit
          ? {
              limit: options.rateLimit.limit,
              remaining: options.rateLimit.remaining,
              resetAtEpochMs: options.rateLimit.resetAtEpochMs,
            }
          : undefined,
      },
    },
    {
      status: options?.status ?? 200,
      headers: buildHeaders(options?.rateLimit),
    }
  );
}

export function apiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    details?: unknown;
    rateLimit?: RateLimitResult;
  }
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details: options?.details,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        rateLimit: options?.rateLimit
          ? {
              limit: options.rateLimit.limit,
              remaining: options.rateLimit.remaining,
              resetAtEpochMs: options.rateLimit.resetAtEpochMs,
            }
          : undefined,
      },
    },
    {
      status: options?.status ?? 400,
      headers: buildHeaders(options?.rateLimit),
    }
  );
}
