import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UsersPage from './UsersPage'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    body: object
    constructor(msg: string, status: number, body: object) {
      super(msg)
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { globalRole: string } }) => unknown) =>
    sel({ user: { globalRole: 'ADMIN' } }),
}))

import { apiFetch } from '@/lib/api'
const mockApiFetch = vi.mocked(apiFetch)

const USERS = [
  { id: 'u1', email: 'alice@co.com', displayName: 'Alice', role: 'ADMIN' },
  { id: 'u2', email: 'bob@co.com',   displayName: 'Bob',   role: 'USER'  },
]

const CLUSTERS = [{ id: 'cl1', name: 'Prod' }]

const DLQ_CONFIGS = [
  {
    id: 'cfg1', clusterId: 'cl1', displayName: 'Orders DLQ',
    userAssignments: [{ userId: 'u2', role: 'VIEWER' }],
  },
  {
    id: 'cfg2', clusterId: 'cl1', displayName: 'Payments DLQ',
    userAssignments: [],
  },
]

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/api/auth/users')        return Promise.resolve(USERS)
    if (path === '/api/clusters')          return Promise.resolve(CLUSTERS)
    if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
    return Promise.resolve(undefined)
  })
})

describe('UsersPage', () => {
  it('renders user list', async () => {
    render(<UsersPage />, { wrapper: wrapper() })
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('bob@co.com')).toBeInTheDocument()
  })

  it('shows Manage Access button per user', async () => {
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    expect(screen.getAllByRole('button', { name: /manage access/i })).toHaveLength(2)
  })

  it('opens assign modal on Manage Access click', async () => {
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[1]) // Bob
    expect(await screen.findByRole('heading', { name: 'Manage Access' })).toBeInTheDocument()
    expect(screen.getByText('Current DLQ Access')).toBeInTheDocument()
    expect(screen.getByText(/Bob.*bob@co\.com/)).toBeInTheDocument()
  })

  it('modal shows existing assignment for user', async () => {
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[1]) // Bob
    expect(await screen.findByText('Orders DLQ')).toBeInTheDocument()
  })

  it('modal lists unassigned configs in Add Access dropdown', async () => {
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[1]) // Bob
    await screen.findByText('Orders DLQ')
    // Payments DLQ not assigned to Bob → should appear in dropdown
    expect(screen.getByRole('option', { name: /Payments DLQ/i })).toBeInTheDocument()
    // Orders DLQ already assigned → should NOT appear in dropdown
    const options = screen.queryAllByRole('option', { name: /Orders DLQ.*Prod/i })
    expect(options).toHaveLength(0)
  })

  it('calls PUT to assign user to DLQ config', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/auth/users')        return Promise.resolve(USERS)
      if (path === '/api/clusters')          return Promise.resolve(CLUSTERS)
      if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
      if (path === '/api/dlq-configs/cfg2/users') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[1])
    await screen.findByRole('heading', { name: 'Manage Access' })

    // first combobox inside "Add Access" section is the config picker
    const configSelect = screen.getAllByRole('combobox').find(
      (el) => el.querySelector('option[value="cfg2"]') !== null ||
              Array.from(el.querySelectorAll('option')).some(o => (o as HTMLOptionElement).value === 'cfg2')
    ) as HTMLSelectElement
    await user.selectOptions(configSelect, 'cfg2')

    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/dlq-configs/cfg2/users',
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  it('calls DELETE to revoke user from DLQ config', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/auth/users')        return Promise.resolve(USERS)
      if (path === '/api/clusters')          return Promise.resolve(CLUSTERS)
      if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
      if (path === '/api/dlq-configs/cfg1/users/u2' && init?.method === 'DELETE')
        return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[1])
    await screen.findByText('Orders DLQ')

    await user.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/dlq-configs/cfg1/users/u2',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('closes modal when clicking ✕', async () => {
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: /manage access/i })[0])
    await screen.findByRole('heading', { name: 'Manage Access' })

    // ✕ is the last button added to the DOM (inside modal header)
    const closeBtn = screen.getAllByRole('button').find(b => b.textContent === '✕')!
    await user.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Manage Access' })).not.toBeInTheDocument()
    })
  })

  it('Add User form creates user on submit', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/auth/users' && !init?.method) return Promise.resolve(USERS)
      if (path === '/api/auth/users' && init?.method === 'POST')
        return Promise.resolve({ id: 'u3', email: 'carol@co.com', displayName: 'Carol', role: 'USER' })
      if (path === '/api/clusters')          return Promise.resolve(CLUSTERS)
      if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
      return Promise.resolve(undefined)
    })
    const user = userEvent.setup()
    render(<UsersPage />, { wrapper: wrapper() })
    await screen.findByText('Alice')

    await user.click(screen.getByRole('button', { name: /add user/i }))
    await user.type(screen.getByLabelText(/email/i), 'carol@co.com')
    await user.type(screen.getByLabelText(/display name/i), 'Carol')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/auth/users',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
