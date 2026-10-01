import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import { Button, Card, Input, LoadingSpinner, Textarea } from "@/components/ui";

interface Template {
  brand_name: string;
  accent_color: string;
  subject: string;
  heading: string;
  intro: string;
  bullets: string[];
  instructions: string;
  button_text: string;
  expiry_note: string;
  footer: string;
}

interface TemplateResponse extends Template {
  logo_file: string | null;
  placeholders: string[];
  defaults: Template;
}

const errMsg = (err: any, fallback: string) => err?.response?.data?.error?.message ?? fallback;
const FIELDS: (keyof Template)[] = ["brand_name", "accent_color", "subject", "heading", "intro", "bullets", "instructions", "button_text", "expiry_note", "footer"];
const pick = (t: Template): Template => Object.fromEntries(FIELDS.map((k) => [k, t[k]])) as unknown as Template;

export default function EmailTemplatePage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["email-template"],
    queryFn: async () => (await api.get<TemplateResponse>("/email-template")).data,
  });

  useEffect(() => {
    if (data && !draft) setDraft(pick(data));
  }, [data, draft]);

  // Live preview: render the unsaved draft on the server (same renderer as the real email).
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      api
        .post("/email-template/preview", draft)
        .then((res) => setPreviewHtml(res.data.html))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, data?.logo_file]);

  const saveMutation = useMutation({
    mutationFn: async () => api.put("/email-template", draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template"] });
      toast.success("Your email template has been saved.");
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't save the template. Please check the fields and try again.")),
  });

  const testMutation = useMutation({
    mutationFn: async () => (await api.post("/email-template/test", draft)).data,
    onSuccess: (res) => toast.success(`A test email was sent to ${res.sent_to}.`),
    onError: (err) => toast.error(errMsg(err, "We couldn't send the test email.")),
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) return api.delete("/email-template/logo");
      const form = new FormData();
      form.append("file", file);
      return api.post("/email-template/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template"] });
      toast.success("Logo updated.");
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't update the logo.")),
  });

  if (isLoading || !draft || !data) return <LoadingSpinner size="lg" className="text-primary-500" />;
  const set = <K extends keyof Template>(key: K, value: Template[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invitation Email</h1>
          <p className="mt-1 text-sm text-gray-500">Customize the logo and wording of the email sent to new team members.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDraft(pick(data.defaults))}>
            <RotateCcw size={15} /> Reset to default
          </Button>
          <Button variant="outline" onClick={() => testMutation.mutate()} loading={testMutation.isPending}>
            <Send size={15} /> Send test to me
          </Button>
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save size={15} /> Save template
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Branding</h2>
            </Card.Header>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                {data.logo_file ? <img src={`/uploads/email/${data.logo_file}`} alt="Logo" className="h-full w-full object-cover" /> : <ImagePlus className="text-gray-300" />}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) logoMutation.mutate(f);
                    e.target.value = "";
                  }}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={logoMutation.isPending}>
                    Upload logo
                  </Button>
                  {data.logo_file && (
                    <Button variant="ghost" size="sm" onClick={() => logoMutation.mutate(null)}>
                      <Trash2 size={14} /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-400">PNG, JPG, WEBP or GIF, up to 2 MB. Square images look best.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input label="Brand name" value={draft.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Accent colour</label>
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(draft.accent_color) ? draft.accent_color : "#0f766e"}
                  onChange={(e) => set("accent_color", e.target.value)}
                  className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
                />
              </div>
            </div>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Message</h2>
            </Card.Header>
            <div className="space-y-4">
              <Input label="Subject line" value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
              <Input label="Heading" value={draft.heading} onChange={(e) => set("heading", e.target.value)} />
              <Textarea label="Intro message" rows={2} value={draft.intro} onChange={(e) => set("intro", e.target.value)} />
              <Textarea
                label="Highlights (one per line)"
                rows={4}
                value={draft.bullets.join("\n")}
                onChange={(e) => set("bullets", e.target.value.split("\n").slice(0, 6))}
              />
              <Textarea label="Sign-in instructions" rows={3} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Button text" value={draft.button_text} onChange={(e) => set("button_text", e.target.value)} />
                <Input label="Expiry note" value={draft.expiry_note} onChange={(e) => set("expiry_note", e.target.value)} />
              </div>
              <Input label="Footer" value={draft.footer} onChange={(e) => set("footer", e.target.value)} />
            </div>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              <p className="mb-1.5 font-medium text-gray-600">Placeholders you can use in any text field</p>
              <div className="flex flex-wrap gap-1.5">
                {data.placeholders.map((p) => (
                  <code key={p} className="rounded bg-white px-1.5 py-0.5 ring-1 ring-gray-200">{`{{${p}}}`}</code>
                ))}
              </div>
              <p className="mt-2">The sign-in details box (email and temporary password) and the accept button are always included.</p>
            </div>
          </Card>
        </div>

        <div className="xl:sticky xl:top-0">
          <Card padding={false} className="overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Live preview</div>
            <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="h-[760px] w-full bg-gray-100" />
          </Card>
        </div>
      </div>
    </div>
  );
}
