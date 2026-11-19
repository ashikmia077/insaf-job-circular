import type { WorkerQueueTopic } from "@/types/worker.types";
import { getServerEnv } from "@/config/env.config";

export interface QueueMessageEnvelope<TPayload> {
  messageId: string;
  topic: WorkerQueueTopic;
  enqueuedAtIso: string;
  payload: TPayload;
}

/**
 * Redis Queue Producer Interface (Phase 1 Architecture Contract).
 * Bridges Next.js Admin/API actions with the Python Background Workers via Redis lists/streams.
 */
export class RedisQueueService {
  public isConfigured(): boolean {
    const env = getServerEnv();
    return Boolean(env.REDIS_URL || env.UPSTASH_REDIS_REST_URL);
  }

  public createEnvelope<TPayload>(
    topic: WorkerQueueTopic,
    payload: TPayload
  ): QueueMessageEnvelope<TPayload> {
    return {
      messageId: crypto.randomUUID(),
      topic,
      enqueuedAtIso: new Date().toISOString(),
      payload,
    };
  }
}

export const redisQueueService = new RedisQueueService();
