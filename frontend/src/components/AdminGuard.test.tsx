import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminGuard from './AdminGuard'
import type { AuthState } from '@/stores/authStore'

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
    mockUseAuthStore.mockImplementation((sel) =>
      sel({ user: { globalRole: 'ADMIN' } } as unknown as AuthState)
    )
    render(withRouter(<AdminGuard><span>protected</span></AdminGuard>))
    expect(screen.getByText('protected')).toBeInTheDocument()
  })

  it('redirects non-admin USER to /messages', () => {
    mockUseAuthStore.mockImplementation((sel) =>
      sel({ user: { globalRole: 'USER' } } as unknown as AuthState)
    )
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AdminGuard><span>protected</span></AdminGuard>
      </MemoryRouter>
    )
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('redirects when user is null', () => {
    mockUseAuthStore.mockImplementation((sel) =>
      sel({ user: null } as unknown as AuthState)
    )
    render(
      <MemoryRouter initialEntries={['/clusters']}>
        <AdminGuard><span>protected</span></AdminGuard>
      </MemoryRouter>
    )
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })
})
