import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Card, LoadingSpinner } from "@/components/ui";

// The emailed link lands here; opening it marks the invitation as accepted.
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This invitation link is incomplete.");
      return;
    }
    api
      .post("/auth/accept-invite", { token })
      .then((res) => {
        setEmail(res.data.email);
        setState("ok");
      })
      .catch((err) => {
        setMessage(err?.response?.data?.error?.message ?? "We couldn't verify this invitation.");
        setState("error");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sidebar via-primary-800 to-primary-600 p-4">
      <Card className="w-full max-w-md p-8 text-center shadow-xl">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar">
            <Zap className="h-5 w-5 text-primary-400" />
          </div>
          <span className="text-xl font-bold tracking-tight">Social Hub</span>
        </div>
        {state === "loading" && <LoadingSpinner className="mx-auto text-primary-500" />}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={44} />
            <h1 className="text-xl font-semibold">Invitation accepted</h1>
            <p className="mt-2 text-sm text-gray-600">
              Welcome aboard! Sign in as <b>{email}</b> using the temporary password from your invitation email. You'll be asked to set a
              new password right after signing in.
            </p>
            <Link to="/login" className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Continue to sign in
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto mb-3 text-red-500" size={44} />
            <h1 className="text-xl font-semibold">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline">
              Go to sign in
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
