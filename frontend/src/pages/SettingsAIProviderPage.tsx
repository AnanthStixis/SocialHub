import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import SettingsNav from "@/components/SettingsNav";
import { Badge, Button, Card, Input } from "@/components/ui";

interface OpenAIStatus {
  configured: boolean;
  source: "settings" | "env" | "none";
  model: string | null;
}

export default function SettingsAIProviderPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");

  const { data: status } = useQuery({
    queryKey: ["ai-provider-status"],
    queryFn: async () => (await api.get<OpenAIStatus>("/settings/ai-provider")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.put("/settings/ai-provider", { api_key: apiKey, base_url: baseUrl || null, model: model || null }),
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["ai-provider-status"] });
      toast.success("The AI provider settings have been saved.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't save the AI provider settings."),
  });

  const removeMutation = useMutation({
    mutationFn: async () => api.delete("/settings/ai-provider"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-provider-status"] });
      toast.success("The AI provider key has been removed.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't remove the AI provider key."),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="AI Provider"
        back={
          <Link to="/settings/social-accounts" className="mb-1 inline-block text-sm text-primary-600 hover:text-primary-700">
            ← Back
          </Link>
        }
      />
      <SettingsNav />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">OpenAI-compatible API</h2>
          {status?.configured ? (
            <Badge variant="success">
              Configured{status.source === "env" ? " (.env)" : ""} · {status.model}
            </Badge>
          ) : (
            <Badge variant="warning">Using demo generator</Badge>
          )}
        </div>

        <div className="space-y-3">
          <Input label="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Base URL (optional)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
            <Input label="Model (optional)" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={!apiKey} loading={saveMutation.isPending}>
            Save
          </Button>
          {status?.configured && status.source === "settings" && (
            <Button variant="danger" onClick={() => removeMutation.mutate()} loading={removeMutation.isPending}>
              Remove
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
