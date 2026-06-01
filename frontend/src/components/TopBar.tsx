import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const Logo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinejoin="round">
    <rect x="2.5" y="5.5" width="19" height="13" rx="1.5" />
    <path d="m2.5 6.5 9.5 7 9.5-7" />
    <circle cx="12" cy="14" r="1.2" fill="hsl(var(--primary))" stroke="none" />
  </svg>
)

export default function TopBar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      height: 44,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 14px',
      borderBottom: '1px solid hsl(var(--border))',
      background: 'hsl(var(--background))',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo />
        <Link
          to="/clusters"
          style={{ fontWeight: 600, fontSize: 13, letterSpacing: -0.01, color: 'inherit', textDecoration: 'none' }}
        >
          Dead Letter Society
        </Link>
      </div>
      <div style={{ flex: 1 }} />
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
          <Link
            to="/profile"
            style={{ textDecoration: 'none', color: 'inherit', fontSize: 12 }}
          >
            {user.displayName}
          </Link>
          <span className={`badge role-${user.globalRole.toLowerCase()}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
            {user.globalRole}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
