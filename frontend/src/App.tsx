import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="dls min-h-screen">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <div className="p-8">
              <h1 className="t-h1">Dead Letter Society</h1>
              <p className="t-small mt-2">Welcome. Configure your first Kafka cluster to get started.</p>
            </div>
          } />
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
