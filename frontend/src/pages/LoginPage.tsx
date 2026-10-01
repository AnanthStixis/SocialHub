import LoginArt, { LoginHero } from "@/components/LoginArt";
import Wordmark from "@/components/Wordmark";
import LoginBento from "@/components/LoginBento";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button, Input } from "@/components/ui";

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
  const [params] = useSearchParams();
  const bento = params.get("v") === "2";
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

  const form = (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className={`flex items-center justify-center gap-3 pb-2 ${bento ? "hidden" : ""}`}>
            <img src="/logo.svg" alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow-[0_6px_16px_rgba(15,118,110,0.28)]" />
            <div className="flex flex-col items-start">
              <Wordmark className="text-4xl leading-none" />
              <p className="mt-1 text-[12.5px] font-medium leading-none tracking-wide text-gray-500">Create. Schedule. Publish. Grow.</p>
            </div>
          </div>
          <div className={bento ? "" : "text-center"}>
            <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          </div>

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
  );

  if (bento) {
    return (
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.9fr)_1.3fr]">
        <div className="flex flex-col justify-between bg-white p-8 sm:p-12">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-9 w-9 shrink-0 rounded-[10px] shadow-[0_2px_8px_rgba(15,118,110,0.3)]" />
            <Wordmark className="text-[18px]" />
          </div>
          <div className="mx-auto w-full max-w-sm py-10">{form}</div>
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Feedwren</p>
        </div>
        <LoginBento />
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-4 lg:justify-end lg:pr-[12%] 2xl:pr-[14%]">
      <LoginArt />
      <LoginHero />
      <div className="w-full max-w-[26rem] rounded-[1.75rem] bg-gradient-to-br from-sky-300/70 via-white to-pink-300/70 p-px shadow-[0_30px_80px_-20px_rgba(15,23,42,0.28)]">
        <div className="rounded-[1.7rem] bg-white/80 p-8 backdrop-blur-2xl">
          {form}
          <p className="mt-6 text-center text-xs text-gray-400">&copy; {new Date().getFullYear()} Feedwren</p>
        </div>
      </div>
    </div>
  );
}
