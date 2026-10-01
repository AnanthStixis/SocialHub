import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Facebook, Instagram, Link2, Linkedin, RefreshCw, Unlink } from "lucide-react";
import { api } from "@/lib/api";
import SettingsNav from "@/components/SettingsNav";
import { useOrganization } from "@/lib/organization";
import { SocialAccount } from "@/lib/types";
import toast from "@/lib/toast";
import { Button } from "@/components/ui";

const STATUS_BADGE: Record<SocialAccount["status"], { label: string; dot: string; cls: string }> = {
  CONNECTED: { label: "Active", dot: "bg-emerald-500", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ERROR: { label: "Error", dot: "bg-red-500", cls: "border-red-200 bg-red-50 text-red-700" },
  DISCONNECTED: { label: "Disconnected", dot: "bg-gray-400", cls: "border-gray-200 bg-gray-50 text-gray-600" },
};

function StatusPill({ status }: { status: SocialAccount["status"] }) {
  const b = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${b.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
      {b.label}
    </span>
  );
}

function IconTile({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50" style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

const pillBtn =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function AccountRow({
  account,
  icon,
  onTest,
  onReconnect,
  onDisconnect,
  testMessage,
}: {
  account: SocialAccount;
  icon: ReactNode;
  onTest: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  testMessage?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <IconTile size={48}>{icon}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{account.account_name}</p>
          <p className="truncate text-xs text-gray-500">{account.external_account_id}</p>
          <p className="text-xs text-gray-400">Connected {new Date(account.created_at).toLocaleDateString()}</p>
        </div>
        <StatusPill status={account.status} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onTest} className={`${pillBtn} border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <Activity size={15} /> Test
          </button>
          <button type="button" onClick={onReconnect} className={`${pillBtn} border-gray-300 text-gray-800 hover:bg-gray-50`}>
            <RefreshCw size={15} /> Reconnect
          </button>
          <button type="button" onClick={onDisconnect} className={`${pillBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}>
            <Unlink size={15} /> Disconnect
          </button>
        </div>
      </div>
      {testMessage && <p className="mt-2 pl-16 text-xs text-gray-500">{testMessage}</p>}
    </div>
  );
}

function ConnectionCard({
  icon,
  title,
  org,
  provider,
  connected,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  org: string;
  provider: string;
  connected: boolean;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile>{icon}</IconTile>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        {connected ? (
          <StatusPill status="CONNECTED" />
        ) : (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">Not connected</span>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-500">
        Connect {provider} to make your accounts available to all members of <b className="text-gray-900">{org}</b>.
      </p>
      <div className="mt-4 space-y-3">{children}</div>
      {!connected && <div className="mt-2">{action}</div>}
    </section>
  );
}

export default function SettingsSocialAccountsPage() {
  const queryClient = useQueryClient();
  const org = useOrganization().name;
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const { data: accounts } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: async () => (await api.get<SocialAccount[]>("/social-accounts")).data,
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setBanner({ type: "success", message: `${connected} connected successfully.` });
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      setSearchParams({}, { replace: true });
    } else if (error) {
      setBanner({ type: "error", message: `Connection failed: ${error}` });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const connectMetaMutation = useMutation({
    mutationFn: async () => {
      const { data: authInfo } = await api.get("/social-accounts/meta/authorize-url");
      if (authInfo.demo_mode) {
        await api.post("/social-accounts/meta/connect");
        setBanner({ type: "success", message: "Meta connected (demo mode)." });
        queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
        return;
      }
      if (!authInfo.credentials_configured) {
        toast.warning("App credentials are required before connecting. Add them under Settings → Platform Apps.");
        return;
      }
      window.location.href = authInfo.authorize_url;
    },
  });

  const connectLinkedInMutation = useMutation({
    mutationFn: async () => {
      const { data: authInfo } = await api.get("/social-accounts/linkedin/authorize-url");
      if (authInfo.demo_mode) {
        await api.post("/social-accounts/linkedin/connect", {});
        setBanner({ type: "success", message: "LinkedIn connected (demo mode)." });
        queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
        return;
      }
      if (!authInfo.credentials_configured) {
        toast.warning("App credentials are required before connecting. Add them under Settings → Platform Apps.");
        return;
      }
      window.location.href = authInfo.authorize_url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => api.post(`/social-accounts/accounts/${accountId}/disconnect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
  });

  const [testingName, setTestingName] = useState<string | null>(null);
  const testMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // Keep the overlay up long enough to read even when the check is instant.
      const [res] = await Promise.all([api.post(`/social-accounts/accounts/${accountId}/test`), new Promise((r) => setTimeout(r, 900))]);
      return res.data as { connected: boolean; message: string };
    },
    onSuccess: (data, accountId) => {
      setTestResults((prev) => ({ ...prev, [accountId]: data.message }));
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      if (data.connected) toast.success(data.message);
      else toast.error(data.message);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "We couldn't test this connection. Please try again."),
    onSettled: () => setTestingName(null),
  });
  const runTest = (a: SocialAccount) => {
    setTestingName(a.account_name);
    testMutation.mutate(a.id);
  };

  const facebookAccounts = accounts?.filter((a) => a.platform === "FACEBOOK") ?? [];
  const instagramAccounts = accounts?.filter((a) => a.platform === "INSTAGRAM") ?? [];
  const linkedinAccount = accounts?.find((a) => a.platform === "LINKEDIN");
  const metaConnected = facebookAccounts.length > 0 || instagramAccounts.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {testingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="alertdialog" aria-busy="true" aria-label="Testing connection">
          <div className="w-80 rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
            <p className="text-sm font-semibold text-gray-900">Testing connection</p>
            <p className="mt-1 truncate text-xs text-gray-500">{testingName}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="test-progress h-full w-1/3 rounded-full bg-primary-500" />
            </div>
          </div>
        </div>
      )}
      <SettingsNav />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Social Accounts</h1>

      {banner && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            banner.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="space-y-5">
        <ConnectionCard
          icon={<Facebook size={22} className="text-blue-600" />}
          title="Meta connection"
          org={org}
          provider="a Facebook account"
          connected={metaConnected}
          action={
            <Button onClick={() => connectMetaMutation.mutate()} loading={connectMetaMutation.isPending}>
              <Link2 size={16} /> {connectMetaMutation.isPending ? "Connecting..." : "Connect Facebook account"}
            </Button>
          }
        >
          {facebookAccounts.length > 0 && (
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Facebook size={13} className="text-blue-600" /> Facebook Pages
            </p>
          )}
          {facebookAccounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              icon={<Facebook size={22} className="text-blue-600" />}
              onTest={() => runTest(a)}
              onReconnect={() => connectMetaMutation.mutate()}
              onDisconnect={() => disconnectMutation.mutate(a.id)}
              testMessage={testResults[a.id]}
            />
          ))}
          {instagramAccounts.length > 0 && (
            <p className="flex items-center gap-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Instagram size={13} className="text-pink-600" /> Instagram Accounts
            </p>
          )}
          {instagramAccounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              icon={<Instagram size={22} className="text-pink-600" />}
              onTest={() => runTest(a)}
              onReconnect={() => connectMetaMutation.mutate()}
              onDisconnect={() => disconnectMutation.mutate(a.id)}
              testMessage={testResults[a.id]}
            />
          ))}
        </ConnectionCard>

        <ConnectionCard
          icon={<Linkedin size={22} className="text-sky-700" />}
          title="LinkedIn connection"
          org={org}
          provider="a LinkedIn profile"
          connected={!!linkedinAccount}
          action={
            <Button onClick={() => connectLinkedInMutation.mutate()} loading={connectLinkedInMutation.isPending}>
              <Link2 size={16} /> {connectLinkedInMutation.isPending ? "Connecting..." : "Connect LinkedIn"}
            </Button>
          }
        >
          {linkedinAccount && (
            <AccountRow
              account={linkedinAccount}
              icon={<Linkedin size={22} className="text-sky-700" />}
              onTest={() => runTest(linkedinAccount)}
              onReconnect={() => connectLinkedInMutation.mutate()}
              onDisconnect={() => disconnectMutation.mutate(linkedinAccount.id)}
              testMessage={testResults[linkedinAccount.id]}
            />
          )}
        </ConnectionCard>
      </div>

      <p className="mt-6 space-x-4 text-sm">
        <Link to="/settings/platform-apps" className="text-primary-600 hover:underline">
          Manage platform app credentials
        </Link>
        <Link to="/settings/ai-provider" className="text-primary-600 hover:underline">
          Configure AI provider
        </Link>
      </p>
    </div>
  );
}
