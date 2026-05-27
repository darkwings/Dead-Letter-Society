import { useState, useCallback, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import NoteThread from '@/components/NoteThread'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { StatusBadge } from '@/components/StatusBadge'
import ReplayWizard from './ReplayWizard'

interface DlqConfigSummary {
  id: string
  displayName: string
}

interface MessageDetail {
  id: string
  dlqConfigId: string
  partition: number
  kafkaOffset: number
  kafkaTimestamp: string
  status: string
  schemaDecodeFailed: boolean
  schemaId: number | null
  ingestedAt: string
  decodedPayload: unknown | null
  rawPayload: string | null
  key: string | null
  headers: Record<string, string>
}

export default function MessageDetailPage() {
  const { messageId } = useParams<{ messageId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showReplay, setShowReplay] = useState(false)

  const { data: msg, isLoading, error } = useQuery({
    queryKey: ['message', messageId],
    queryFn: () => apiFetch<MessageDetail>(`/api/messages/${messageId}`),
    enabled: !!messageId,
  })

  const { data: config } = useQuery({
    queryKey: ['dlq-config', msg?.dlqConfigId],
    queryFn: () => apiFetch<DlqConfigSummary>(`/api/dlq-configs/${msg!.dlqConfigId}`),
    enabled: !!msg?.dlqConfigId,
  })

  const onSseEvent = useCallback(
    (event: { type: string; data?: Record<string, unknown> }) => {
      if (
        event.type === 'MESSAGE_STATUS_CHANGED' &&
        event.data?.messageId === messageId
      ) {
        queryClient.invalidateQueries({ queryKey: ['message', messageId] })
      }
    },
    [messageId, queryClient],
  )
  useSSE(onSseEvent)

  useEffect(() => {
    if (error && (error as { status?: number }).status === 404) {
      toast.error('Message no longer available.')
      navigate('..', { relative: 'path' })
    }
  }, [error, navigate])

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch<MessageDetail>(`/api/messages/${messageId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (updatedMsg) => {
      // update detail cache immediately
      queryClient.setQueryData(['message', messageId], updatedMsg)

      // patch the new status in-place in list caches so navigating back shows
      // the correct status without waiting for a background refetch
      const patchStatus = (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const paged = old as { messages: Array<{ id: string; status: string }>; total: number; page: number; size: number }
        return {
          ...paged,
          messages: paged.messages.map((m) =>
            m.id === messageId ? { ...m, status: updatedMsg.status } : m
          ),
        }
      }
      queryClient.setQueriesData({ queryKey: ['messages', msg?.dlqConfigId] }, patchStatus)
      queryClient.setQueriesData({ queryKey: ['all-messages'] }, patchStatus)

      toast.success('Status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div style={{ padding: 32 }}>
        <p className="t-small">Loading…</p>
      </div>
    )
  }

  if (error || !msg) {
    return (
      <div style={{ padding: 32 }}>
        <p className="t-small" style={{ color: 'hsl(var(--destructive))' }} data-testid="message-unavailable">
          Message not found.
        </p>
        <Link to=".." relative="path" style={{ fontSize: 12, color: 'hsl(var(--primary))', textDecoration: 'none', display: 'block', marginTop: 8 }}>
          Back to list
        </Link>
      </div>
    )
  }

  const headerEntries = Object.entries(msg.headers ?? {})

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
        <Link
          to={msg?.dlqConfigId ? `/dlq-configs/${msg.dlqConfigId}/messages` : '..'}
          style={{ textDecoration: 'none', color: 'hsl(var(--muted-foreground))' }}
        >
          {config?.displayName ?? 'Messages'}
        </Link>
        <span>/</span>
        <span style={{ color: 'hsl(var(--foreground))' }}>Message Detail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="t-h1" style={{ marginBottom: 4 }}>Message Detail</h1>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{msg.id}</p>
        </div>
        <StatusBadge status={msg.status} testId="status-badge" />
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: 16, marginBottom: 24 }}>
        <div>
          <p className="t-small" style={{ marginBottom: 2 }}>Partition</p>
          <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{msg.partition}</p>
        </div>
        <div>
          <p className="t-small" style={{ marginBottom: 2 }}>Offset</p>
          <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{msg.kafkaOffset}</p>
        </div>
        <div>
          <p className="t-small" style={{ marginBottom: 2 }}>Kafka Timestamp</p>
          <p style={{ fontSize: 12 }}>{new Date(msg.kafkaTimestamp).toLocaleString()}</p>
        </div>
        <div>
          <p className="t-small" style={{ marginBottom: 2 }}>Ingested At</p>
          <p style={{ fontSize: 12 }}>{new Date(msg.ingestedAt).toLocaleString()}</p>
        </div>
        {msg.schemaId != null && (
          <div style={{ gridColumn: '1 / -1' }}>
            <p className="t-small" style={{ marginBottom: 2 }}>Schema ID</p>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {msg.schemaId}
              {msg.schemaDecodeFailed && (
                <span style={{ marginLeft: 8, color: 'hsl(var(--warning))' }}>(decode failed)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {(msg.status === 'NEW' || msg.status === 'UNDER_REVIEW' || msg.status === 'REPLAY_FAILED') && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {msg.status === 'NEW' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => statusMutation.mutate('UNDER_REVIEW')}
              disabled={statusMutation.isPending}
            >
              Mark Under Review
            </button>
          )}
          <button
            className="btn btn-destructive btn-sm"
            onClick={() => statusMutation.mutate('DISCARDED')}
            disabled={statusMutation.isPending}
          >
            Discard
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowReplay(true)}
            data-testid="replay-button"
          >
            Replay
          </button>
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 className="t-h2" style={{ marginBottom: 8 }}>Decoded Payload</h2>
        {msg.decodedPayload ? (
          <pre
            data-testid="decoded-payload"
            className="card json"
            style={{ padding: 16, overflow: 'auto', maxHeight: 320, fontSize: 12 }}
          >
            {JSON.stringify(msg.decodedPayload, null, 2)}
          </pre>
        ) : (
          <p className="t-small">
            {msg.schemaDecodeFailed ? 'Schema decode failed.' : 'No decoded payload (raw message).'}
          </p>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="t-h2" style={{ marginBottom: 8 }}>Raw Payload</h2>
        {msg.rawPayload ? (
          <pre
            data-testid="raw-payload"
            className="card t-code"
            style={{ padding: 16, overflow: 'auto', maxHeight: 160, wordBreak: 'break-all' }}
          >
            {msg.rawPayload}
          </pre>
        ) : (
          <p className="t-small">Empty payload.</p>
        )}
      </section>

      {headerEntries.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 className="t-h2" style={{ marginBottom: 8 }}>Headers</h2>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {headerEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{k}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 16, marginBottom: 24 }}>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>Notes</h2>
        {messageId && <NoteThread messageId={messageId} />}
      </section>

      {showReplay && messageId && (
        <ReplayWizard
          messageId={messageId}
          resolvedTopic={(msg.headers as Record<string, string>)['x-original-topic'] ?? null}
          hasDecodedPayload={!!msg.decodedPayload}
          decodedPayload={msg.decodedPayload}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  )
}
