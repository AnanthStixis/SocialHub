import { useEffect, useRef, useState } from "react";
import { Building2, Check, Power, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import { useOrganization } from "@/lib/organization";
import { initials, nameParts, roleLabel } from "@/lib/user";
import { useAuthStore } from "@/store/auth";
import { Button, Input, Modal } from "@/components/ui";

const errMsg = (err: any, fallback: string) => err?.response?.data?.error?.message ?? fallback;

export function Avatar({ size = 36 }: { size?: number }) {
  const user = useAuthStore((s) => s.user);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 font-semibold text-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(user)}
    </span>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const parts = nameParts(user);
  const [first, setFirst] = useState(parts.first);
  const [last, setLast] = useState(parts.last);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/me", { first_name: first, last_name: last });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...data } : s.user }));
      toast.success("Your profile has been updated.");
      onClose();
    } catch (err) {
      toast.error(errMsg(err, "We couldn't update your profile. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("Your new password must be at least 8 characters long.");
    if (next !== confirm) return toast.error("The new passwords don't match.");
    setChanging(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Your password has been changed.");
    } catch (err) {
      toast.error(errMsg(err, "We couldn't change your password."));
    } finally {
      setChanging(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit profile">
      <form onSubmit={saveProfile} className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar size={52} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
            <p className="text-xs text-gray-500">{roleLabel(user)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={first} onChange={(e) => setFirst(e.target.value)} required />
          <Input label="Last name" value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!first.trim() || !last.trim()}>
            Save profile
          </Button>
        </div>
      </form>

      <form onSubmit={changePassword} className="mt-6 space-y-3 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-900">Change password</h3>
        <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <Input label="Confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={changing} disabled={!current || !next || !confirm}>
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Avatar button in the top bar; opens a popover with account details, edit profile and sign out. */
export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const { first, last } = nameParts(user);
  const workspace = useOrganization().name;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="cursor-pointer rounded-full ring-2 ring-transparent transition hover:ring-primary-200 focus-visible:outline-none focus-visible:ring-primary-400"
      >
        <Avatar />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right animate-[menu-in_.15s_ease-out] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-100 p-4">
            <Avatar size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{`${first} ${last}`.trim() || user?.full_name}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="border-b border-gray-100 p-2">
            <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Workspace</p>
            <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/60 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary-600 ring-1 ring-primary-100">
                <Building2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{workspace}</p>
                <p className="text-xs text-gray-500">{roleLabel(user)}</p>
              </div>
              <Check size={16} className="text-primary-600" />
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setProfile(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <UserCog size={16} />
              </span>
              Edit profile
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-sm">
                <Power size={16} />
              </span>
              Sign out
            </button>
          </div>
        </div>
      )}
      {profile && <ProfileModal onClose={() => setProfile(false)} />}
    </div>
  );
}
