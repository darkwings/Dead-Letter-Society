import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/settings/general', label: 'General' },
  { to: '/clusters', label: 'Clusters' },
  { to: '/admin/users', label: 'Members & Roles' },
] as const

export default function SettingsLayout() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <nav style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid hsl(var(--border))',
        padding: '20px 8px',
      }}>
        <p className="t-h4" style={{ padding: '0 8px', marginBottom: 12 }}>Settings</p>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'block',
              padding: '7px 10px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              borderRadius: 'var(--radius)',
              color: isActive ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
              background: isActive ? 'hsl(var(--accent))' : 'transparent',
              marginBottom: 2,
            })}
            end
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <Outlet />
      </main>
    </div>
  )
}
