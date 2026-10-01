import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, MailPlus, Pencil, Send, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import { useAuthStore } from "@/store/auth";
import { Badge, Button, Card, Input, LoadingSpinner, Modal } from "@/components/ui";

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string;
  role: "ADMIN" | "PUBLISHER";
  status: "ACTIVE" | "PENDING" | "DISABLED";
  created_at: string;
}

const ROLES: { value: Member["role"]; label: string; description: string }[] = [
  { value: "ADMIN", label: "Admin", description: "Full access to organization settings, accounts and members" },
  { value: "PUBLISHER", label: "Publisher", description: "Create, schedule and publish posts; no org settings or team management" },
];

const STATUS_BADGE: Record<Member["status"], { variant: "success" | "warning" | "default"; label: string }> = {
  ACTIVE: { variant: "success", label: "Active" },
  PENDING: { variant: "warning", label: "Invite pending" },
  DISABLED: { variant: "default", label: "Disabled" },
};

const errMsg = (err: any, fallback: string) => err?.response?.data?.error?.message ?? fallback;

function RolePicker({ value, onChange }: { value: Member["role"]; onChange: (r: Member["role"]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Role</p>
      {ROLES.map((r) => (
        <label
          key={r.value}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
            value === r.value ? "border-primary-500 bg-primary-50/60" : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input type="radio" name="role" checked={value === r.value} onChange={() => onChange(r.value)} className="mt-1 accent-primary-600" />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              {r.label}
              <Badge variant={r.value === "ADMIN" ? "info" : "warning"}>{r.label}</Badge>
            </span>
            <span className="mt-0.5 block text-sm text-gray-500">{r.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  role: Member["role"];
}
const EMPTY: FormState = { first_name: "", last_name: "", email: "", role: "PUBLISHER" };

export default function TeamPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [modal, setModal] = useState<{ mode: "invite" } | { mode: "edit"; member: Member } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => (await api.get<Member[]>("/team/members")).data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-members"] });

  const openInvite = () => {
    setForm(EMPTY);
    setModal({ mode: "invite" });
  };
  const openEdit = (m: Member) => {
    setForm({ first_name: m.first_name ?? m.full_name.split(" ")[0] ?? "", last_name: m.last_name ?? m.full_name.split(" ").slice(1).join(" "), email: m.email, role: m.role });
    setModal({ mode: "edit", member: m });
  };

  const inviteMutation = useMutation({
    mutationFn: async () => (await api.post("/team/invite", form)).data,
    onSuccess: (res) => {
      setModal(null);
      refresh();
      if (res.email_sent) toast.success(`Invitation sent to ${res.member.email}.`);
      else toast.warning(`${res.member.full_name} was added, but the email could not be sent: ${res.email_error}. Use “Resend invitation” once email is working.`);
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't send the invitation. Please try again.")),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => api.put(`/team/members/${id}`, { first_name: form.first_name, last_name: form.last_name, role: form.role }),
    onSuccess: () => {
      setModal(null);
      refresh();
      toast.success("Team member updated.");
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't update this member.")),
  });

  const toggleMutation = useMutation({
    mutationFn: async (m: Member) => api.post(`/team/members/${m.id}/${m.status === "DISABLED" ? "enable" : "disable"}`),
    onSuccess: (_r, m) => {
      refresh();
      toast.success(m.status === "DISABLED" ? `${m.full_name} can sign in again.` : `${m.full_name} has been disabled and can no longer sign in.`);
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't change this member's status.")),
  });

  const resendMutation = useMutation({
    mutationFn: async (m: Member) => (await api.post(`/team/members/${m.id}/resend`)).data,
    onSuccess: (res) => {
      refresh();
      if (res.email_sent) toast.success(`Invitation re-sent to ${res.member.email}. Their password was reset to the default.`);
      else toast.error(`The email could not be sent: ${res.email_error}`);
    },
    onError: (err) => toast.error(errMsg(err, "We couldn't resend the invitation.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (m: Member) => api.delete(`/team/members/${m.id}`),
    onSuccess: (_r, m) => {
      setDeleteTarget(null);
      refresh();
      toast.success(`${m.full_name} has been removed from the team.`);
    },
    onError: (err) => {
      setDeleteTarget(null);
      toast.error(errMsg(err, "We couldn't remove this member."));
    },
  });

  const valid = form.first_name.trim() && form.last_name.trim() && (modal?.mode === "edit" || /^\S+@\S+\.\S+$/.test(form.email));

  return (
    <div>
      <PageHeader
        title="Team &amp; Roles"
        description="Invite teammates and control what each role can access."
        actions={
          <Button variant="primary" onClick={openInvite}>
            <UserPlus size={16} /> Invite member
          </Button>
        }
      />

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-primary-500">
                    <LoadingSpinner />
                  </td>
                </tr>
              )}
              {members?.map((m) => {
                const isMe = m.id === me?.id;
                const st = STATUS_BADGE[m.status];
                return (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.full_name} {isMe && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.role === "ADMIN" ? "info" : "warning"}>{m.role === "ADMIN" ? "Admin" : "Publisher"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {m.status === "PENDING" && (
                          <Button variant="ghost" size="sm" className="!p-1.5" title="Resend invitation" aria-label="Resend invitation" onClick={() => resendMutation.mutate(m)} disabled={resendMutation.isPending}>
                            <Send size={16} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="!p-1.5" title="Edit" aria-label="Edit" onClick={() => openEdit(m)}>
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1.5"
                          title={m.status === "DISABLED" ? "Enable" : isMe ? "You can't disable yourself" : "Disable"}
                          aria-label={m.status === "DISABLED" ? "Enable" : "Disable"}
                          disabled={isMe || toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate(m)}
                        >
                          {m.status === "DISABLED" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Ban size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1.5 hover:!bg-red-50 hover:!text-red-600"
                          title={isMe ? "You can't delete yourself" : "Delete"}
                          aria-label="Delete"
                          disabled={isMe}
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === "edit" ? "Edit team member" : "Invite team member"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            if (modal?.mode === "edit") updateMutation.mutate(modal.member.id);
            else inviteMutation.mutate();
          }}
        >
          {modal?.mode === "invite" && (
            <p className="flex items-start gap-2 text-sm text-gray-500">
              <MailPlus size={16} className="mt-0.5 shrink-0" />
              They'll get an email with a temporary password and will be asked to choose their own when they first sign in.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <Input label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
          <Input
            label="Email address"
            type="email"
            value={form.email}
            disabled={modal?.mode === "edit"}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="colleague@company.com"
            helperText={modal?.mode === "edit" ? "Email can't be changed." : undefined}
            required
          />
          <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={inviteMutation.isPending || updateMutation.isPending}>
              {modal?.mode === "edit" ? "Save changes" : "Send invitation"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove team member?" size="sm">
        <p className="text-sm text-gray-500">
          {deleteTarget?.full_name} ({deleteTarget?.email}) will lose access immediately. Their posts stay in the workspace.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
