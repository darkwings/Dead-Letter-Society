import { useAuthStore } from '@/stores/authStore'

const BASE = ''

export interface ApiErrorBody {
  type?: string
  title?: string
  status?: number
  detail?: string
  message?: string
  violations?: Array<{ field: string; message: string }>
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(message: string, status: number, body: ApiErrorBody) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get violations() {
    return this.body.violations
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init?.headers,
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body: ApiErrorBody = await res.json().catch(() => ({}))
    const msg = body.detail ?? body.message ?? res.statusText
    throw new ApiError(msg, res.status, body)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
