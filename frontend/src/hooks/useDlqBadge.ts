import { useState, useCallback } from 'react'
import { useSSE } from './useSSE'

export function useDlqBadge(dlqConfigId: string) {
  const [newCount, setNewCount] = useState(0)

  const onEvent = useCallback(
    (event: { type: string; data?: Record<string, unknown> }) => {
      if (
        event.type === 'FETCH_COMPLETED' &&
        event.data?.dlqConfigId === dlqConfigId
      ) {
        setNewCount((prev) => prev + ((event.data?.newMessagesCount as number) ?? 0))
      }
    },
    [dlqConfigId],
  )

  useSSE(onEvent)

  return { newCount, clearBadge: () => setNewCount(0) }
}
