import { useTheme } from '@/hooks/useTheme'

export default function SettingsGeneralPage() {
  const { theme, toggle } = useTheme()

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>General</h1>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Theme</p>
            <p className="t-small">Currently: {theme === 'dark' ? 'Dark' : 'Light'} mode</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={toggle}
            style={{ minWidth: 120 }}
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </div>
  )
}
