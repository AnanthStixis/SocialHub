import type { AuthUser } from "@/store/auth";

export function nameParts(u: AuthUser | null) {
  const parts = (u?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = u?.first_name || parts[0] || "";
  const last = u?.last_name || parts.slice(1).join(" ");
  return { first, last };
}

export const initials = (u: AuthUser | null) => {
  const { first, last } = nameParts(u);
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "U";
};

export const roleLabel = (u: AuthUser | null) => (u?.roles ?? []).map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(", ");
