import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Mail, LogOut } from 'lucide-react'

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
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 18px',
      borderBottom: '1px solid hsl(var(--border))',
      background: 'hsl(225 22% 6%)',
      flexShrink: 0,
    }}>
      <Link to="/clusters" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
        <Mail size={16} strokeWidth={1.6} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
        <span style={{ fontFamily: "'Syne', 'Geist', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: -0.2, lineHeight: 1 }}>
          Dead Letter Society
        </span>
      </Link>
      <div style={{ flex: 1 }} />
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/profile" style={{ textDecoration: 'none', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
            {user.displayName}
          </Link>
          <span style={{
            fontFamily: "'Syne', 'Geist', sans-serif",
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 7px', borderRadius: 3,
            background: 'hsl(258 30% 14%)',
            border: '1px solid hsl(var(--primary) / 0.45)',
            color: 'hsl(var(--primary))',
            textTransform: 'uppercase',
          }}>
            {user.globalRole}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Sign out"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', height: 26 }}
          >
            <LogOut size={12} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
