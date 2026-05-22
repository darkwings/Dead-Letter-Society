import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})
type FormValues = z.infer<typeof schema>

interface LoginResponse {
  token: string
  user: { id: string; email: string; displayName: string; role: 'ADMIN' | 'USER' }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/setup/status'),
  })

  useEffect(() => {
    if (token) { navigate('/clusters', { replace: true }); return }
    if (setupStatus?.setupRequired) navigate('/setup', { replace: true })
  }, [token, setupStatus, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setAuth(data.token, {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        globalRole: data.user.role,
      })
      navigate('/clusters', { replace: true })
    },
    onError: (err: unknown) => {
      const e = err as { status?: number }
      if (e.status === 403) {
        toast.error('Your account is locked. Contact your administrator.')
      } else {
        toast.error('Invalid email or password.')
      }
    },
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'hsl(var(--background))', padding: '0 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="t-h2" style={{ marginBottom: 4 }}>Dead Letter Society</h1>
          <p className="t-small">Sign in to your account.</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="email" style={{ fontSize: 12, fontWeight: 500 }}>Email</label>
            <input
              id="email"
              type="email"
              className={`input${errors.email ? ' error' : ''}`}
              placeholder="you@company.com"
              {...register('email')}
            />
            {errors.email && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.email.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="password" style={{ fontSize: 12, fontWeight: 500 }}>Password</label>
            <input
              id="password"
              type="password"
              className={`input${errors.password ? ' error' : ''}`}
              {...register('password')}
            />
            {errors.password && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.password.message}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={mutation.isPending} style={{ width: '100%', marginTop: 4 }}>
            {mutation.isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
