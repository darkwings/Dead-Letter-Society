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
  replayedDecodedPayload: unknown | null
}

// ── JSON syntax highlighter ───────────────────────────────────────────────────

function highlightJson(json: string): React.ReactNode[] {
  const TOKEN = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g
  const result: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = TOKEN.exec(json)) !== null) {
    if (match.index > last) {
      result.push(<span key={key++}>{json.slice(last, match.index)}</span>)
    }
    if (match[1] && match[2]) {
      result.push(<span key={key++} style={{ color: 'hsl(var(--code-key))' }}>{match[1]}</span>)
      result.push(<span key={key++} style={{ color: 'hsl(var(--code-punct))' }}>:</span>)
    } else if (match[3]) {
      result.push(<span key={key++} style={{ color: 'hsl(var(--code-string))' }}>{match[3]}</span>)
    } else if (match[4]) {
      result.push(<span key={key++} style={{ color: match[4] === 'null' ? 'hsl(var(--code-null))' : 'hsl(var(--code-bool))' }}>{match[4]}</span>)
    } else if (match[5]) {
      result.push(<span key={key++} style={{ color: 'hsl(var(--code-number))' }}>{match[5]}</span>)
    } else if (match[6]) {
      result.push(<span key={key++} style={{ color: 'hsl(var(--code-punct))' }}>{match[6]}</span>)
    }
    last = match.index + match[0].length
  }
  if (last < json.length) result.push(<span key={key++}>{json.slice(last)}</span>)
  return result
}

function JsonViewer({ data, testId }: { data: unknown; testId?: string }) {
  const json = JSON.stringify(data, null, 2)
  const lines = json.split('\n')
  const highlighted = highlightJson(json).reduce<React.ReactNode[][]>((acc, node) => {
    const str = typeof node === 'string' ? node : (node as React.ReactElement).props.children as string
    const parts = str.split('\n')
    if (parts.length === 1) {
      acc[acc.length - 1].push(node)
    } else {
      parts.forEach((part, i) => {
        if (i > 0) acc.push([])
        if (part) {
          const el = node as React.ReactElement
          acc[acc.length - 1].push(
            i === 0 ? node : <span key={`${el.key}-${i}`} style={(el.props as React.CSSProperties & { style?: React.CSSProperties }).style}>{part}</span>
          )
        }
      })
    }
    return acc
  }, [[]])

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex', overflow: 'auto', flex: 1, minHeight: 0,
        fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
        fontSize: 12, lineHeight: 1.65,
        background: 'hsl(var(--code-bg))',
        borderRadius: 'var(--radius)',
        padding: '14px 0',
      }}
    >
      <div style={{
        color: 'hsl(var(--code-punct))', userSelect: 'none',
        paddingLeft: 16, paddingRight: 14, textAlign: 'right',
        minWidth: 42, flexShrink: 0, opacity: 0.5,
      }}>
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre style={{ margin: 0, flex: 1, paddingRight: 16, color: 'hsl(var(--code-fg))' }}>
        {highlighted.map((lineNodes, i) => (
          <div key={i}>{lineNodes.length ? lineNodes : '​'}</div>
        ))}
      </pre>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'payload' | 'raw' | 'headers' | 'replayed'

export default function MessageDetailPage() {
  const { messageId } = useParams<{ messageId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showReplay, setShowReplay] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('payload')

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
      if (event.type === 'MESSAGE_STATUS_CHANGED' && event.data?.messageId === messageId) {
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
      queryClient.setQueryData(['message', messageId], updatedMsg)
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
    return <div style={{ padding: 32 }}><p className="t-small">Loading…</p></div>
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
  const canAct = msg.status === 'NEW' || msg.status === 'UNDER_REVIEW' || msg.status === 'REPLAY_FAILED'

  const tabs: { id: Tab; label: string }[] = [
    { id: 'payload', label: 'Decoded Payload' },
    { id: 'raw', label: 'Raw' },
    { id: 'headers', label: `Headers${headerEntries.length ? ` (${headerEntries.length})` : ''}` },
    ...((msg.status === 'REPLAYED' || msg.status === 'REPLAY_FAILED') && msg.replayedDecodedPayload
      ? [{ id: 'replayed' as Tab, label: 'Replayed Payload' }]
      : []),
  ]

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Left panel ── */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 0 }} className="scroll">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
          <Link
            to={msg.dlqConfigId ? `/dlq-configs/${msg.dlqConfigId}/messages` : '..'}
            style={{ textDecoration: 'none', color: 'hsl(var(--muted-foreground))' }}
          >
            {config?.displayName ?? 'Messages'}
          </Link>
          <span>/</span>
          <span style={{ color: 'hsl(var(--foreground))' }}>Message Detail</span>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="t-h1" style={{ marginBottom: 4 }}>Message Detail</h1>
            <p style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11, color: 'hsl(var(--muted-foreground))', wordBreak: 'break-all' }}>
              {msg.id}
            </p>
          </div>
          <StatusBadge status={msg.status} testId="status-badge" />
        </div>

        {/* Metadata strip */}
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap',
          padding: '10px 16px', borderRadius: 'var(--radius)',
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
          marginBottom: 20, fontSize: 12,
        }}>
          {[
            { label: 'Partition', value: String(msg.partition), mono: true },
            { label: 'Offset', value: String(msg.kafkaOffset), mono: true },
            { label: 'Kafka Timestamp', value: new Date(msg.kafkaTimestamp).toLocaleString(), mono: false },
            { label: 'Ingested At', value: new Date(msg.ingestedAt).toLocaleString(), mono: false },
            ...(msg.schemaId != null ? [{ label: 'Schema ID', value: String(msg.schemaId) + (msg.schemaDecodeFailed ? ' (decode failed)' : ''), mono: true }] : []),
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginBottom: 2, fontWeight: 500 }}>{label}</p>
              <p style={{ fontFamily: mono ? "'Geist Mono', ui-monospace, monospace" : undefined }}>{value}</p>
            </div>
          ))}
        </div>


        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid hsl(var(--border))', marginBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
                color: activeTab === t.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                borderBottom: activeTab === t.id ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column', paddingTop: 16 }}>
          {activeTab === 'payload' && (
            msg.decodedPayload ? (
              <JsonViewer data={msg.decodedPayload} testId="decoded-payload" />
            ) : (
              <p className="t-small">{msg.schemaDecodeFailed ? 'Schema decode failed.' : 'No decoded payload.'}</p>
            )
          )}

          {activeTab === 'raw' && (
            msg.rawPayload ? (
              <pre
                data-testid="raw-payload"
                style={{
                  fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12, lineHeight: 1.65, padding: 16, margin: 0,
                  background: 'hsl(var(--code-bg))', borderRadius: 'var(--radius)',
                  overflow: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                  color: 'hsl(var(--code-fg))',
                }}
              >
                {msg.rawPayload}
              </pre>
            ) : (
              <p className="t-small">Empty payload.</p>
            )
          )}

          {activeTab === 'headers' && (
            headerEntries.length > 0 ? (
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
                        <td style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 12 }}>{k}</td>
                        <td style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 12 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="t-small">No headers.</p>
            )
          )}

          {activeTab === 'replayed' && (
            msg.replayedDecodedPayload
              ? <JsonViewer data={msg.replayedDecodedPayload} testId="replayed-decoded-payload" />
              : <p className="t-small">Original payload replayed without modifications.</p>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: '1px solid hsl(var(--border))',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Actions */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
          <p className="t-h4" style={{ marginBottom: 12 }}>Actions</p>
          {canAct ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowReplay(true)}
                data-testid="replay-button"
                disabled={statusMutation.isPending}
              >
                Replay
              </button>
              {msg.status === 'NEW' && (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => statusMutation.mutate('UNDER_REVIEW')}
                  disabled={statusMutation.isPending}
                >
                  Mark Under Review
                </button>
              )}
              <button
                className="btn btn-destructive"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => statusMutation.mutate('DISCARDED')}
                disabled={statusMutation.isPending}
              >
                Discard
              </button>
            </div>
          ) : (
            <p className="t-small">No actions available for status <strong>{msg.status.replace(/_/g, ' ')}</strong>.</p>
          )}
        </div>

        {/* Note Thread */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {messageId && <NoteThread messageId={messageId} />}
        </div>
      </div>

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
