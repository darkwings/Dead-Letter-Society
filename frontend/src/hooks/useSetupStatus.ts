import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface SetupStatus {
  setupRequired: boolean
  oidcEnabled: boolean
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<SetupStatus>('/api/setup/status'),
    staleTime: Infinity,
  })
}
