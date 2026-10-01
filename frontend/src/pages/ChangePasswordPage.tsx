import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import toast from "@/lib/toast";
import { useAuthStore } from "@/store/auth";
import { Button, Card, Input } from "@/components/ui";

// Shown right after the first sign-in with the temporary password; nothing else is reachable until it is changed.
export default function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!accessToken || !user) return <Navigate to="/login" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("Your new password must be at least 8 characters long.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, must_change_password: false } : s.user }));
      toast.success("Your password has been updated.");
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "We couldn't update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sidebar via-primary-800 to-primary-600 p-4">
      <Card className="w-full max-w-sm p-8 shadow-xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Set your password</h1>
            <p className="mt-1 text-sm text-gray-500">
              {user.first_name ? `Hi ${user.first_name}, for` : "For"} your security, replace the temporary password before you continue.
            </p>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <Input label="Temporary password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" helperText="At least 8 characters." />
          <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          <Button type="submit" loading={loading} className="w-full">
            Update password
          </Button>
          <button type="button" onClick={logout} className="cursor-pointer text-center text-xs text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
