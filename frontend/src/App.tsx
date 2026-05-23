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
import UsersPage from '@/pages/admin/UsersPage'
import RouteGuard from '@/components/RouteGuard'
import AppShell from '@/components/AppShell'

function AuthLayout() {
  return (
    <RouteGuard>
      <AppShell />
    </RouteGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="dls" style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/clusters" replace />} />
          <Route path="/dashboard" element={<Navigate to="/clusters" replace />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/clusters" element={<ClusterListPage />} />
            <Route path="/clusters/new" element={<CreateClusterPage />} />
            <Route path="/clusters/:clusterId/dlq-configs" element={<DlqConfigListPage />} />
            <Route path="/clusters/:clusterId/dlq-configs/new" element={<CreateDlqConfigPage />} />
            <Route path="/clusters/:clusterId/dlq-configs/:configId/edit" element={<EditDlqConfigPage />} />
            <Route path="/dlq-configs/:configId/messages" element={<MessageListPage />} />
            <Route path="/messages/:messageId" element={<MessageDetailPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
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
