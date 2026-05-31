import { Component } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import SetupPage from '@/pages/SetupPage'
import LoginPage from '@/pages/LoginPage'
import ClusterListPage from '@/pages/clusters/ClusterListPage'
import CreateClusterPage from '@/pages/clusters/CreateClusterPage'
import DlqConfigListPage from '@/pages/dlqconfig/DlqConfigListPage'
import CreateDlqConfigPage from '@/pages/dlqconfig/CreateDlqConfigPage'
import EditDlqConfigPage from '@/pages/dlqconfig/EditDlqConfigPage'
import MessageListPage from '@/pages/messages/MessageListPage'
import MessageDetailPage from '@/pages/messages/MessageDetailPage'
import AllMessagesPage from '@/pages/messages/AllMessagesPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UsersPage from '@/pages/admin/UsersPage'
import SettingsLayout from '@/pages/settings/SettingsLayout'
import SettingsGeneralPage from '@/pages/settings/SettingsGeneralPage'
import RouteGuard from '@/components/RouteGuard'
import AdminGuard from '@/components/AdminGuard'
import AppShell from '@/components/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/useTheme'

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ padding: 32 }}>
          <h1 className="t-h2">Something went wrong.</h1>
          <p className="t-small" style={{ marginTop: 8 }}>
            <a href="/" style={{ color: 'hsl(var(--primary))' }}>Reload the app</a>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user)
  if (user?.globalRole === 'ADMIN') return <Navigate to="/dashboard" replace />
  return <Navigate to="/messages" replace />
}

function AuthLayout() {
  return (
    <RouteGuard>
      <AppShell />
    </RouteGuard>
  )
}

function AppWithTheme() {
  useTheme()
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="dls" style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthLayout />}>
            {/* admin-only routes */}
            <Route path="/dashboard" element={<AdminGuard><DashboardPage /></AdminGuard>} />
            <Route path="/clusters" element={<AdminGuard><ClusterListPage /></AdminGuard>} />
            <Route path="/clusters/new" element={<AdminGuard><CreateClusterPage /></AdminGuard>} />
            <Route path="/clusters/:clusterId/dlq-configs" element={<AdminGuard><DlqConfigListPage /></AdminGuard>} />
            <Route path="/clusters/:clusterId/dlq-configs/new" element={<AdminGuard><CreateDlqConfigPage /></AdminGuard>} />
            <Route path="/clusters/:clusterId/dlq-configs/:configId/edit" element={<AdminGuard><EditDlqConfigPage /></AdminGuard>} />
            <Route path="/admin/users" element={<AdminGuard><UsersPage /></AdminGuard>} />
            <Route path="/settings" element={<AdminGuard><SettingsLayout /></AdminGuard>}>
              <Route index element={<Navigate to="/settings/general" replace />} />
              <Route path="general" element={<SettingsGeneralPage />} />
              <Route path="clusters" element={<Navigate to="/clusters" replace />} />
              <Route path="users" element={<Navigate to="/admin/users" replace />} />
            </Route>
            {/* accessible to all authenticated users */}
            <Route path="/dlq-configs/:configId/messages" element={<MessageListPage />} />
            <Route path="/messages" element={<AllMessagesPage />} />
            <Route path="/messages/:messageId" element={<MessageDetailPage />} />
          </Route>
          <Route path="*" element={
            <div style={{ padding: 32 }}>
              <h1 className="t-h1">404</h1>
              <p className="t-small" style={{ marginTop: 8 }}>Page not found.</p>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppWithTheme />
    </ErrorBoundary>
  )
}
