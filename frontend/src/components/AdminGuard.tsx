import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  children: React.ReactNode
}

export default function AdminGuard({ children }: Props) {
  const user = useAuthStore((s) => s.user)
  if (user?.globalRole !== 'ADMIN') return <Navigate to="/messages" replace />
  return <>{children}</>
}
