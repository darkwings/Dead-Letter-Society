import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface UserResponse {
  id: string
  email: string
  displayName: string
  role: string
}

const schema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'At least 2 characters'),
  password: z.string().min(8, 'At least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserResponse[]>('/api/auth/users'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', displayName: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<UserResponse>('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
      reset()
      setShowForm(false)
    },
    onError: (e: unknown) => {
      const err = e as { status?: number; body?: { message?: string }; message?: string }
      if (err.status === 409) {
        toast.error('Email already in use.')
      } else {
        toast.error(err.body?.message ?? err.message ?? 'Failed to create user')
      }
    },
  })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="t-h1">Users</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24, maxWidth: 400 }}>
          <h2 className="t-h3" style={{ marginBottom: 16 }}>New User</h2>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="newEmail" style={{ fontSize: 12, fontWeight: 500 }}>Email</label>
              <input id="newEmail" type="email" className={`input${errors.email ? ' error' : ''}`} {...register('email')} />
              {errors.email && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.email.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="newDisplayName" style={{ fontSize: 12, fontWeight: 500 }}>Display Name</label>
              <input id="newDisplayName" className={`input${errors.displayName ? ' error' : ''}`} {...register('displayName')} />
              {errors.displayName && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.displayName.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="newPassword" style={{ fontSize: 12, fontWeight: 500 }}>Password</label>
              <input id="newPassword" type="password" className={`input${errors.password ? ' error' : ''}`} {...register('password')} />
              {errors.password && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.password.message}</span>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending} style={{ marginTop: 4 }}>
              {mutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <p className="t-small">Loading…</p>
      ) : users.length === 0 ? (
        <p className="t-small">No users yet.</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.displayName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.email}</td>
                  <td>
                    <span className={`badge role-${u.role.toLowerCase()}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
