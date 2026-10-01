export type Platform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PostPlatform {
  id: string;
  platform: Platform;
  content: string | null;
  hashtags: string[] | null;
  status: "PENDING" | "GENERATED" | "EDITED" | "PUBLISHED" | "FAILED";
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
  social_account_id: string | null;
}

export interface MediaAsset {
  id: string;
  file_name: string;
  file_url: string;
  media_type: "image" | "video";
  mime_type: string | null;
  order_index: number;
  created_at: string;
}

export interface Post {
  id: string;
  idea: string;
  status: string;
  creation_mode: "MANUAL" | "AI";
  target_audience: string | null;
  objective: string | null;
  brand_voice: string | null;
  tone: string | null;
  keywords: string | null;
  language: string;
  cta: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  platforms: PostPlatform[];
  media: MediaAsset[];
  scheduled_at: string | null;
  scheduled_timezone: string | null;
}

export const ALL_PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN"];

export interface SocialAccount {
  id: string;
  platform: Platform;
  account_name: string;
  external_account_id: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  last_sync_at: string | null;
  created_at: string;
}

export interface PlatformAppStatus {
  platform: Platform;
  configured: boolean;
  source: "settings" | "env" | "none";
  client_id_preview: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CalendarEntry {
  post_id: string;
  idea: string;
  status: string;
  platforms: Platform[];
  scheduled_at: string | null;
  published_at: string | null;
}

export interface PublishingAttempt {
  id: string;
  attempt_number: number;
  success: boolean;
  external_post_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PublishingJob {
  id: string;
  post_id: string;
  post_platform_id: string;
  platform: Platform;
  status: "PENDING" | "IN_PROGRESS" | "SUCCESS" | "FAILED" | "RETRYING";
  attempt_count: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  attempts: PublishingAttempt[];
  post_idea: string | null;
  page_name: string | null;
}
