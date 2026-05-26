import { Outlet } from 'react-router-dom'

export default function SettingsLayout() {
  return (
    <div style={{ padding: 32 }}>
      <Outlet />
    </div>
  )
}
