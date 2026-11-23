import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { DevicesPage } from './pages/DevicesPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { SupportPage } from './pages/SupportPage';
import { ContentPage } from './pages/ContentPage';
import { StoragePage } from './pages/StoragePage';
import { AppConfigPage } from './pages/AppConfigPage';
import { SystemPage } from './pages/SystemPage';
import { AuditPage } from './pages/AuditPage';
import { AdminsPage } from './pages/AdminsPage';
import { PushPage } from './pages/PushPage';
import { SecurityPage } from './pages/SecurityPage';
import { SmsPage } from './pages/SmsPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Authenticating...</div>;
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="push" element={<PushPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="storage" element={<StoragePage />} />
            <Route path="config" element={<AppConfigPage />} />
            <Route path="sms" element={<SmsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="admins" element={<AdminsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
