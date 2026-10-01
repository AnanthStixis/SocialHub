import { Facebook, Instagram, Linkedin, type LucideIcon } from "lucide-react";
import { Platform } from "@/lib/types";

export const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  FACEBOOK: "bg-[#1877F2]",
  INSTAGRAM: "bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5]",
  LINKEDIN: "bg-[#0A66C2]",
};

export default function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  const Icon = PLATFORM_ICONS[platform];
  const badgeSize = Math.round(size * 1.375);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${PLATFORM_COLORS[platform]}`}
      style={{ width: badgeSize, height: badgeSize }}
    >
      <Icon size={size * 0.65} className="text-white" />
    </span>
  );
}
