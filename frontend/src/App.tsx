import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';

// Auth Components
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Lightweight pages - loaded immediately
import LoginPage from './pages/admin/LoginPage';
import OrganizationsPage from './pages/admin/OrganizationsPage';

// Heavy pages - lazy loaded for better initial bundle size
const SourcesPage = lazy(() => import('./pages/SourcesPage'));
const MappingsPage = lazy(() => import('./pages/MappingsPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const OrgDetailPage = lazy(() => import('./pages/admin/OrgDetailPage'));
const SystemDashboard = lazy(() => import('./pages/admin/SystemDashboard'));
const ChangePasswordPage = lazy(() => import('./pages/admin/ChangePasswordPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const DeveloperHub = lazy(() => import('./pages/DeveloperHub'));
const ClientOnboarding = lazy(() => import('./pages/ClientOnboarding'));
const PublicConnectPage = lazy(() => import('./pages/PublicConnectPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes (no layout, no protection) */}
            <Route path="/login" element={<LoginPage />} />

            {/* Change password (protected but allows password change state) */}
            <Route
              path="/admin/change-password"
              element={
                <ProtectedRoute allowPasswordChange>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            {/* Client-facing routes (no layout, no protection) */}
            <Route path="/org/:clientSlug" element={<ClientOnboarding />} />
            <Route path="/org/:clientSlug/settings" element={<ClientOnboarding />} />
            {/* Public connect page - handles both token-based (:tokenOrSlug) URLs */}
            <Route path="/connect/:tokenOrSlug" element={<PublicConnectPage />} />

            {/* Protected admin routes with layout */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* Legacy Dashboard */}
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/sources" element={<SourcesPage />} />
                        <Route path="/mappings" element={<MappingsPage />} />
                        <Route path="/logs" element={<LogsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* Admin Dashboard */}
                        <Route path="/admin" element={<OrganizationsPage />} />
                        <Route path="/admin/organizations" element={<OrganizationsPage />} />
                        <Route path="/admin/org/:slug" element={<OrgDetailPage />} />
                        <Route path="/admin/organizations/:orgId/sources" element={<SourcesPage />} />
                        <Route path="/admin/organizations/:orgId/logs" element={<LogsPage />} />
                        <Route path="/admin/system" element={<SystemDashboard />} />
                        <Route path="/admin/users" element={<UsersPage />} />
                        <Route path="/admin/audit-logs" element={<AuditLogsPage />} />

                        {/* Developer Hub */}
                        <Route path="/developer" element={<DeveloperHub />} />
                      </Routes>
                    </Suspense>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
