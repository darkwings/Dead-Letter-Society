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

interface ClusterItem {
  id: string
  name: string
}

interface UserAssignmentResponse {
  userId: string
  role: 'VIEWER' | 'OPERATOR'
}

interface DlqConfigItem {
  id: string
  clusterId: string
  displayName: string
  userAssignments: UserAssignmentResponse[]
}

const createSchema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'At least 2 characters'),
  password: z.string().min(8, 'At least 8 characters'),
})
type CreateFormValues = z.infer<typeof createSchema>

function useAllDlqConfigs() {
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterItem[]>('/api/clusters'),
  })

  return useQuery({
    queryKey: ['all-dlq-configs-for-users', clusters.map(c => c.id)],
    queryFn: async () => {
      const results: (DlqConfigItem & { clusterName: string })[] = []
      for (const cluster of clusters) {
        const configs = await apiFetch<DlqConfigItem[]>(`/api/clusters/${cluster.id}/dlq-configs`)
        configs.forEach(cfg => results.push({ ...cfg, clusterName: cluster.name }))
      }
      return results
    },
    enabled: clusters.length > 0,
  })
}

interface AssignModalProps {
  user: UserResponse
  onClose: () => void
}

function AssignModal({ user, onClose }: AssignModalProps) {
  const queryClient = useQueryClient()
  const { data: allConfigs = [], isLoading } = useAllDlqConfigs()

  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'OPERATOR'>('VIEWER')

  const userAssignments = allConfigs.filter(cfg =>
    cfg.userAssignments.some(a => a.userId === user.id)
  )
  const unassignedConfigs = allConfigs.filter(cfg =>
    !cfg.userAssignments.some(a => a.userId === user.id)
  )

  const assignMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/dlq-configs/${selectedConfigId}/users`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, role: selectedRole }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dlq-configs-for-users'] })
      toast.success(`Assigned ${user.displayName} to DLQ config`)
      setSelectedConfigId('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeMutation = useMutation({
    mutationFn: (configId: string) =>
      apiFetch(`/api/dlq-configs/${configId}/users/${user.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dlq-configs-for-users'] })
      toast.success('Access removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ configId, role }: { configId: string; role: 'VIEWER' | 'OPERATOR' }) =>
      apiFetch(`/api/dlq-configs/${configId}/users`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dlq-configs-for-users'] })
      toast.success('Role updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 560, padding: 24, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 className="t-h3">Manage Access</h2>
            <p className="t-small" style={{ marginTop: 2 }}>{user.displayName} · {user.email}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Current assignments */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Current DLQ Access</p>
          {isLoading ? (
            <p className="t-small">Loading…</p>
          ) : userAssignments.length === 0 ? (
            <p className="t-small" style={{ color: 'hsl(var(--muted-foreground))' }}>No DLQ configs assigned yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {userAssignments.map(cfg => {
                const assignment = cfg.userAssignments.find(a => a.userId === user.id)!
                return (
                  <div
                    key={cfg.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      background: 'hsl(var(--muted) / 0.4)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cfg.displayName}
                      </p>
                      <p className="t-small" style={{ color: 'hsl(var(--muted-foreground))' }}>{cfg.clusterName}</p>
                    </div>
                    <select
                      className="select"
                      style={{ width: 110, height: 28, fontSize: 11 }}
                      value={assignment.role}
                      onChange={(e) =>
                        changeRoleMutation.mutate({
                          configId: cfg.id,
                          role: e.target.value as 'VIEWER' | 'OPERATOR',
                        })
                      }
                      disabled={changeRoleMutation.isPending}
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="OPERATOR">Operator</option>
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}
                      onClick={() => revokeMutation.mutate(cfg.id)}
                      disabled={revokeMutation.isPending}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add assignment */}
        {unassignedConfigs.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add Access</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="select"
                style={{ flex: 1 }}
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
              >
                <option value="">Select DLQ config…</option>
                {unassignedConfigs.map(cfg => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.displayName} ({cfg.clusterName})
                  </option>
                ))}
              </select>
              <select
                className="select"
                style={{ width: 110 }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'VIEWER' | 'OPERATOR')}
              >
                <option value="VIEWER">Viewer</option>
                <option value="OPERATOR">Operator</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                disabled={!selectedConfigId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? '…' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [managingUser, setManagingUser] = useState<UserResponse | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserResponse[]>('/api/auth/users'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', displayName: '', password: '' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFormValues) =>
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
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending} style={{ marginTop: 4 }}>
              {createMutation.isPending ? 'Creating…' : 'Create User'}
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
                <th />
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
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setManagingUser(u)}
                    >
                      Manage Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {managingUser && (
        <AssignModal user={managingUser} onClose={() => setManagingUser(null)} />
      )}
    </div>
  )
}
