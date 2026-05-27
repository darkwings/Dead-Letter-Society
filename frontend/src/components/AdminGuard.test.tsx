import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminGuard from './AdminGuard'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

import { useAuthStore } from '@/stores/authStore'
const mockUseAuthStore = vi.mocked(useAuthStore)

function withRouter(ui: React.ReactNode) {
  return <MemoryRouter>{ui}</MemoryRouter>
}

describe('AdminGuard', () => {
  it('renders children for ADMIN', () => {
    mockUseAuthStore.mockImplementation((sel: (s: { user: { globalRole: string } }) => unknown) =>
      sel({ user: { globalRole: 'ADMIN' } })
    )
    render(withRouter(<AdminGuard><span>protected</span></AdminGuard>))
    expect(screen.getByText('protected')).toBeInTheDocument()
  })

  it('redirects non-admin USER to /messages', () => {
    mockUseAuthStore.mockImplementation((sel: (s: { user: { globalRole: string } }) => unknown) =>
      sel({ user: { globalRole: 'USER' } })
    )
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AdminGuard><span>protected</span></AdminGuard>
      </MemoryRouter>
    )
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('redirects when user is null', () => {
    mockUseAuthStore.mockImplementation((sel: (s: { user: null }) => unknown) =>
      sel({ user: null })
    )
    render(
      <MemoryRouter initialEntries={['/clusters']}>
        <AdminGuard><span>protected</span></AdminGuard>
      </MemoryRouter>
    )
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })
})
