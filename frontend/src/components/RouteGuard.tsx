import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  children: React.ReactNode
}

export default function RouteGuard({ children }: Props) {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) navigate('/login', { replace: true })
  }, [token, navigate])

  if (!token) return null
  return <>{children}</>
}
