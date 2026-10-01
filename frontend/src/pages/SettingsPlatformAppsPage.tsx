import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import SettingsNav from "@/components/SettingsNav";
import { PlatformAppStatus } from "@/lib/types";
import { Badge, Button, Card, Input } from "@/components/ui";

type AppKey = "FACEBOOK" | "LINKEDIN";

const APPS: { key: AppKey; label: string }[] = [
  { key: "FACEBOOK", label: "Meta (Facebook + Instagram)" },
  { key: "LINKEDIN", label: "LinkedIn" },
];

export default function SettingsPlatformAppsPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { client_id: string; client_secret: string }>>({});

  const { data: apps } = useQuery({
    queryKey: ["platform-apps"],
    queryFn: async () => (await api.get<PlatformAppStatus[]>("/settings/platform-apps")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (key: AppKey) => {
      const draft = drafts[key];
      await api.put(`/settings/platform-apps/${key.toLowerCase()}`, draft);
    },
    onSuccess: (_data, key) => {
      setDrafts((prev) => ({ ...prev, [key]: { client_id: "", client_secret: "" } }));
      queryClient.invalidateQueries({ queryKey: ["platform-apps"] });
      toast.success("The app credentials have been saved.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't save the credentials. Please try again."),
  });

  const removeMutation = useMutation({
    mutationFn: async (key: AppKey) => api.delete(`/settings/platform-apps/${key.toLowerCase()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-apps"] });
      toast.success("The app credentials have been removed.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't remove the credentials."),
  });

  const statusFor = (key: AppKey) => apps?.find((a) => a.platform === key);

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings/social-accounts" className="text-sm text-primary-600 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Apps</h1>
      </div>

      <div className="space-y-4">
        {APPS.map(({ key, label }) => {
          const status = statusFor(key);
          const draft = drafts[key] ?? { client_id: "", client_secret: "" };

          return (
            <Card key={key}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{label}</h2>
                {status?.configured ? (
                  <Badge variant="success">
                    {status.source === "settings" ? "Configured" : "Configured (.env)"} · {status.client_id_preview}
                  </Badge>
                ) : (
                  <Badge>Not configured</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  value={draft.client_id}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, client_id: e.target.value } }))}
                  placeholder="Client ID / App ID"
                />
                <Input
                  value={draft.client_secret}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, client_secret: e.target.value } }))}
                  placeholder="Client Secret / App Secret"
                  type="password"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate(key)}
                  disabled={!draft.client_id || !draft.client_secret}
                  loading={saveMutation.isPending}
                >
                  Save
                </Button>
                {status?.configured && status.source === "settings" && (
                  <Button variant="danger" onClick={() => removeMutation.mutate(key)} loading={removeMutation.isPending}>
                    Remove
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
