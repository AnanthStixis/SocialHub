import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import { useOrganization } from "@/lib/organization";
import SettingsNav from "@/components/SettingsNav";
import { Button, Card, Input } from "@/components/ui";

export default function SettingsOrganizationPage() {
  const queryClient = useQueryClient();
  const { name, isSet } = useOrganization();
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);

  const save = useMutation({
    mutationFn: async () => api.put("/settings/organization", { name: value.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Your organization name has been saved.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't save the organization name."),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Organization" />
      <SettingsNav />
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) save.mutate();
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Building2 size={22} />
            </span>
            <p className="text-sm text-gray-500">
              Shown in the top bar, your account menu and in team invitation emails.
              {!isSet && " Until you save a name, “" + name + "” is used."}
            </p>
          </div>
          <Input label="Organization name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={100} placeholder="Acme Corporation" required />
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!value.trim() || value.trim() === name}>
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
