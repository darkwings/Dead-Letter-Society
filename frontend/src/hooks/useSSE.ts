import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export interface SseEvent {
  type: string
  data?: Record<string, unknown>
}

export function useSSE(onEvent: (event: SseEvent) => void) {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
    es.onmessage = (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data as string) as SseEvent)
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [token, onEvent])
}
