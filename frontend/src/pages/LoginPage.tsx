import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  const REMEMBER_KEY = "smhub-login-email";
  const saved = (() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) ?? "";
    } catch {
      return "";
    }
  })();
  const [email, setEmail] = useState(saved);
  const [remember, setRemember] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Opening the sign-in page ends any session in this browser, so other open tabs
  // are signed out too instead of continuing as the previous user.
  useEffect(() => {
    if (useAuthStore.getState().accessToken) useAuthStore.getState().logout();
    queryClient.clear();
  }, [queryClient]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage unavailable: nothing to remember */
      }
      queryClient.clear();
      setSession(data.access_token, data.refresh_token, meRes.data);
      navigate(meRes.data.must_change_password ? "/change-password" : "/");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sidebar via-primary-800 to-primary-600 p-4">
      <Card className="w-full max-w-sm p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar">
              <Zap className="h-5 w-5 text-primary-400" />
            </div>
            <span className="text-xl font-bold tracking-tight">Social Hub</span>
          </div>
          <h1 className="text-lg font-semibold">Welcome back</h1>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <Input label="Email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary-600" />
            Remember me
          </label>
          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
