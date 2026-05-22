import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import NoteThread from '@/components/NoteThread'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import RouteGuard from '@/components/RouteGuard'
import { useSSE } from '@/hooks/useSSE'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ReplayWizard from './ReplayWizard'

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

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  DISCARDED: 'bg-gray-100 text-gray-600',
  REPLAYED: 'bg-green-100 text-green-800',
  REPLAY_FAILED: 'bg-red-100 text-red-800',
}

export default function MessageDetailPage() {
  const { messageId } = useParams<{ messageId: string }>()
  const queryClient = useQueryClient()
  const [showReplay, setShowReplay] = useState(false)

  const { data: msg, isLoading, error } = useQuery({
    queryKey: ['message', messageId],
    queryFn: () => apiFetch<MessageDetail>(`/api/messages/${messageId}`),
    enabled: !!messageId,
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

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch<MessageDetail>(`/api/messages/${messageId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message', messageId] })
      toast.success('Status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <RouteGuard>
        <div className="p-8">
          <p className="t-small">Loading...</p>
        </div>
      </RouteGuard>
    )
  }

  if (error || !msg) {
    const is404 = error && (error as { status?: number }).status === 404
    return (
      <RouteGuard>
        <div className="p-8">
          <p className="t-small text-destructive" data-testid="message-unavailable">
            {is404 ? 'Message no longer available.' : 'Message not found.'}
          </p>
          <Link to=".." relative="path" className="text-sm hover:underline mt-2 block">
            Back to list
          </Link>
        </div>
      </RouteGuard>
    )
  }

  const headerEntries = Object.entries(msg.headers ?? {})

  return (
    <RouteGuard>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="t-h1 mb-1">Message Detail</h1>
            <p className="font-mono text-sm text-muted-foreground">{msg.id}</p>
          </div>
          <span
            data-testid="status-badge"
            className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[msg.status] ?? ''}`}
          >
            {msg.status.replace('_', ' ')}
          </span>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 border rounded-lg bg-card">
          <div>
            <p className="text-xs text-muted-foreground">DLQ Config</p>
            <p className="font-mono text-sm">{msg.dlqConfigId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Partition / Offset</p>
            <p className="font-mono text-sm">{msg.partition} / {msg.kafkaOffset}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kafka Timestamp</p>
            <p className="text-sm">{new Date(msg.kafkaTimestamp).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ingested At</p>
            <p className="text-sm">{new Date(msg.ingestedAt).toLocaleString()}</p>
          </div>
          {msg.schemaId && (
            <div>
              <p className="text-xs text-muted-foreground">Schema ID</p>
              <p className="font-mono text-sm">
                {msg.schemaId}
                {msg.schemaDecodeFailed && (
                  <span className="ml-2 text-orange-600">(decode failed)</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {(msg.status === 'NEW' || msg.status === 'UNDER_REVIEW' || msg.status === 'REPLAY_FAILED') && (
          <div className="flex gap-2 mb-6">
            {msg.status === 'NEW' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('UNDER_REVIEW')}
                disabled={statusMutation.isPending}
              >
                Mark Under Review
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => statusMutation.mutate('DISCARDED')}
              disabled={statusMutation.isPending}
            >
              Discard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReplay(true)}
              data-testid="replay-button"
            >
              Replay
            </Button>
          </div>
        )}

        {/* Decoded Payload */}
        <section className="mb-6">
          <h2 className="t-h2 mb-2">Decoded Payload</h2>
          {msg.decodedPayload ? (
            <pre
              data-testid="decoded-payload"
              className="p-4 rounded border bg-muted text-sm overflow-auto max-h-80"
            >
              {JSON.stringify(msg.decodedPayload, null, 2)}
            </pre>
          ) : (
            <p className="t-small text-muted-foreground">
              {msg.schemaDecodeFailed ? 'Schema decode failed.' : 'No decoded payload (raw message).'}
            </p>
          )}
        </section>

        {/* Raw Payload */}
        <section className="mb-6">
          <h2 className="t-h2 mb-2">Raw Payload</h2>
          {msg.rawPayload ? (
            <pre
              data-testid="raw-payload"
              className="p-4 rounded border bg-muted font-mono text-xs overflow-auto max-h-40 break-all"
            >
              {msg.rawPayload}
            </pre>
          ) : (
            <p className="t-small text-muted-foreground">Empty payload.</p>
          )}
        </section>

        {/* Headers */}
        {headerEntries.length > 0 && (
          <section className="mb-6">
            <h2 className="t-h2 mb-2">Headers</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headerEntries.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-mono text-sm">{k}</TableCell>
                    <TableCell className="font-mono text-sm">{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <section className="mb-6 p-4 border rounded-lg bg-card">
          <h2 className="t-h2 mb-4">Notes</h2>
          {messageId && <NoteThread messageId={messageId} />}
        </section>
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
    </RouteGuard>
  )
}
