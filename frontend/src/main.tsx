import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { useAuthStore } from "./store/auth";
import "./index.css";

const queryClient = new QueryClient();

// The session lives in localStorage, which all tabs share. Keep every tab in step with it:
// signing out elsewhere signs this tab out; a different user signing in reloads this tab as that user.
window.addEventListener("storage", (e) => {
  if (e.key !== "smhub-auth") return;
  const read = (raw: string | null) => {
    try {
      const st = raw ? JSON.parse(raw).state : null;
      return { token: st?.accessToken ?? null, userId: st?.user?.id ?? null };
    } catch {
      return { token: null, userId: null };
    }
  };
  const next = read(e.newValue);
  const mine = useAuthStore.getState();
  if (!next.token) {
    queryClient.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  } else if (mine.user && next.userId !== mine.user.id) {
    // Only a tab that is signed in as someone else needs to switch; a signed-out tab
    // (e.g. sitting on the login page) stays put, otherwise tabs sign each other out in a loop.
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-center"
          gutter={10}
          toastOptions={{
            duration: 4500,
            style: {
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 10px 30px -10px rgba(17,24,39,0.25)",
              padding: "12px 14px",
              fontSize: "14px",
              fontWeight: 500,
              maxWidth: "420px",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#ffffff" }, style: { borderLeft: "4px solid #10b981" } },
            error: { duration: 6000, iconTheme: { primary: "#ef4444", secondary: "#ffffff" }, style: { borderLeft: "4px solid #ef4444" } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
