import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export default function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/setup/status'),
  })

  useEffect(() => {
    if (setupStatus && !setupStatus.setupRequired) {
      navigate('/login', { replace: true })
    }
  }, [setupStatus, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', displayName: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<void>('/api/setup', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Administrator account created. Please sign in.')
      queryClient.removeQueries({ queryKey: ['setup-status'] })
      navigate('/login', { replace: true })
    },
    onError: (err: unknown) => {
      const e = err as { status?: number }
      if (e.status === 409) {
        toast.error('Setup already complete.')
        queryClient.removeQueries({ queryKey: ['setup-status'] })
        navigate('/login', { replace: true })
      } else {
        toast.error('Setup failed. Please try again.')
      }
    },
  })

  if (isLoading) return null

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'hsl(var(--background))', padding: '0 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="t-h2" style={{ marginBottom: 4 }}>Create Administrator Account</h1>
          <p className="t-small">First-time setup — create the initial admin user.</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="email" style={{ fontSize: 12, fontWeight: 500 }}>Email</label>
            <input
              id="email"
              type="email"
              className={`input${errors.email ? ' error' : ''}`}
              placeholder="admin@company.com"
              {...register('email')}
            />
            {errors.email && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.email.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="displayName" style={{ fontSize: 12, fontWeight: 500 }}>Display Name</label>
            <input
              id="displayName"
              className={`input${errors.displayName ? ' error' : ''}`}
              placeholder="Admin"
              {...register('displayName')}
            />
            {errors.displayName && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.displayName.message}</span>}
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
            {mutation.isPending ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
