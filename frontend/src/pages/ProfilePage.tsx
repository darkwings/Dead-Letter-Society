import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSetupStatus } from '@/hooks/useSetupStatus'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: status } = useSetupStatus()
  const oidcEnabled = status?.oidcEnabled ?? false

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const changeMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordForm) =>
      apiFetch('/api/auth/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      toast.success('Password updated')
      reset()
    },
    onError: (e: unknown) => {
      const err = e as { status?: number; message?: string }
      if (err.status === 401) {
        toast.error('Current password is incorrect')
      } else {
        toast.error('Failed to update password')
      }
    },
  })

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>My Profile</h1>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 className="t-h3" style={{ marginBottom: 16 }}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Display Name</p>
            <p style={{ fontSize: 13 }}>{user?.displayName}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Email</p>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{user?.email}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Role</p>
            <span className={`badge role-${user?.globalRole?.toLowerCase()}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
              {user?.globalRole}
            </span>
          </div>
        </div>
      </div>

      {!oidcEnabled && (
        <div className="card" style={{ padding: 24 }}>
          <h2 className="t-h3" style={{ marginBottom: 16 }}>Change Password</h2>
          <form onSubmit={handleSubmit((d) => changeMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="currentPassword" style={{ fontSize: 12, fontWeight: 500 }}>Current Password</label>
              <input id="currentPassword" type="password" className={`input${errors.currentPassword ? ' error' : ''}`} {...register('currentPassword')} />
              {errors.currentPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.currentPassword.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="newPassword" style={{ fontSize: 12, fontWeight: 500 }}>New Password</label>
              <input id="newPassword" type="password" className={`input${errors.newPassword ? ' error' : ''}`} {...register('newPassword')} />
              {errors.newPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.newPassword.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="confirmPassword" style={{ fontSize: 12, fontWeight: 500 }}>Confirm New Password</label>
              <input id="confirmPassword" type="password" className={`input${errors.confirmPassword ? ' error' : ''}`} {...register('confirmPassword')} />
              {errors.confirmPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.confirmPassword.message}</span>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={changeMutation.isPending} style={{ marginTop: 4 }}>
              {changeMutation.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
