import { getClientEnv } from "@/config/env.config";

export type NotificationTopic =
  | "all_verified_jobs"
  | "category_government"
  | "category_bank"
  | "category_defense"
  | "category_ngo"
  | "category_private"
  | "deadline_48h_reminder";

export interface PushNotificationMessage {
  topic: NotificationTopic;
  title: string;
  body: string;
  targetUrl: string;
  jobId?: string;
}

/**
 * Firebase Cloud Messaging (FCM) Service Contract.
 * Phase 1 defines topic taxonomy and readiness checks without inventing credentials.
 */
export class FcmNotificationService {
  public isClientConfigured(): boolean {
    const env = getClientEnv();
    return Boolean(
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    );
  }
}

export const fcmNotificationService = new FcmNotificationService();
