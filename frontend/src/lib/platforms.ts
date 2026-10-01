import type { Platform } from "@/lib/types";

export const PLATFORM_META: Record<Platform, { name: string; color: string; maxChars: number }> = {
  FACEBOOK: { name: "Facebook", color: "#1877F2", maxChars: 63206 },
  INSTAGRAM: { name: "Instagram", color: "#E4405F", maxChars: 2200 },
  LINKEDIN: { name: "LinkedIn", color: "#0A66C2", maxChars: 3000 },
};

export function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fallback;
}
