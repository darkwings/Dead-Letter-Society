import { Outlet, NavLink } from 'react-router-dom'

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'block',
  padding: '6px 10px',
  borderRadius: 4,
  fontSize: 13,
  textDecoration: 'none',
  color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
  background: isActive ? 'hsl(var(--accent))' : 'transparent',
  fontWeight: isActive ? 500 : 400,
})

export default function SettingsLayout() {
  return (
    <div style={{ padding: 32, display: 'flex', gap: 32 }}>
      <nav style={{ width: 180, flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Settings
        </p>
        <NavLink to="/settings/general" style={({ isActive }) => linkStyle(isActive)}>General</NavLink>
        <NavLink to="/settings/clusters" style={({ isActive }) => linkStyle(isActive)}>Clusters</NavLink>
        <NavLink to="/settings/users" style={({ isActive }) => linkStyle(isActive)}>Members &amp; Roles</NavLink>
      </nav>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  )
}
