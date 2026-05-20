import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import SetupPage from '@/pages/SetupPage'
import LoginPage from '@/pages/LoginPage'
import ClusterListPage from '@/pages/clusters/ClusterListPage'
import CreateClusterPage from '@/pages/clusters/CreateClusterPage'
import CreateDlqConfigPage from '@/pages/dlqconfig/CreateDlqConfigPage'
import RouteGuard from '@/components/RouteGuard'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="dls min-h-screen bg-background text-foreground">
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/clusters" replace />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Navigate to="/clusters" replace />} />
          <Route path="/clusters" element={<ClusterListPage />} />
          <Route path="/clusters/new" element={<CreateClusterPage />} />
          <Route path="/clusters/:clusterId/dlq-configs" element={
            <RouteGuard>
              <div className="p-8">
                <h1 className="t-h1">DLQ Configs</h1>
                <p className="t-small mt-2">DLQ config list coming in Phase 3.</p>
              </div>
            </RouteGuard>
          } />
          <Route path="/clusters/:clusterId/dlq-configs/new" element={<CreateDlqConfigPage />} />
          <Route path="*" element={
            <div className="p-8">
              <h1 className="t-h1">404</h1>
              <p className="t-small">Page not found.</p>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
