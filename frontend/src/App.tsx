import type { ReactElement } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { isAdmin, useAuthStore } from "@/store/auth";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SettingsSocialAccountsPage from "@/pages/SettingsSocialAccountsPage";
import SettingsPlatformAppsPage from "@/pages/SettingsPlatformAppsPage";
import SettingsAIProviderPage from "@/pages/SettingsAIProviderPage";
import CalendarPage from "@/pages/CalendarPage";
import NotificationsPage from "@/pages/NotificationsPage";
import PublishingPage from "@/pages/PublishingPage";
import ContentPage from "@/pages/ContentPage";
import ComposePage from "@/pages/ComposePage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsOrganizationPage from "@/pages/SettingsOrganizationPage";
import TeamPage from "@/pages/TeamPage";
import EmailTemplatePage from "@/pages/EmailTemplatePage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import AppLayout from "@/components/AppLayout";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const mustChange = useAuthStore((s) => s.user?.must_change_password);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (mustChange) return <Navigate to="/change-password" replace />;
  return children;
}

// Publishers are sent to the dashboard if they open an admin-only page.
function AdminRoute({ children }: { children: ReactElement }) {
  const user = useAuthStore((s) => s.user);
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return children;
}

// The old Post pages are disabled; keep old links working.
function LegacyPostRedirect() {
  const { postId } = useParams();
  return <Navigate to={`/compose/${postId}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="compose/:postId" element={<ComposePage />} />
        <Route path="posts" element={<ContentPage />} />
        <Route path="content" element={<Navigate to="/posts" replace />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="content/new" element={<Navigate to="/compose" replace />} />
        <Route path="content/:postId" element={<LegacyPostRedirect />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="team" element={<AdminRoute><TeamPage /></AdminRoute>} />
        <Route path="email-template" element={<AdminRoute><EmailTemplatePage /></AdminRoute>} />
        <Route path="settings" element={<Navigate to="/settings/organization" replace />} />
        <Route path="settings/organization" element={<AdminRoute><SettingsOrganizationPage /></AdminRoute>} />
        <Route path="settings/social-accounts" element={<AdminRoute><SettingsSocialAccountsPage /></AdminRoute>} />
        <Route path="settings/platform-apps" element={<AdminRoute><SettingsPlatformAppsPage /></AdminRoute>} />
        <Route path="settings/ai-provider" element={<AdminRoute><SettingsAIProviderPage /></AdminRoute>} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="publishing" element={<PublishingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
