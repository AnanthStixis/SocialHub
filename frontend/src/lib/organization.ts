import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { nameParts } from "@/lib/user";

/** The organization display name set in Settings, or "<first name>'s Workspace" until one is saved. */
export function useOrganization() {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => (await api.get<{ name: string | null }>("/settings/organization")).data,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const fallback = `${nameParts(user).first || user?.full_name || "My"}'s Workspace`;
  return { name: data?.name || fallback, isSet: !!data?.name };
}
