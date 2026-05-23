import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'

interface AllMessageItem {
  id: string
  dlqConfigId: string
  partition: number
  kafkaOffset: number
  kafkaTimestamp: string
  status: string
  ingestedAt: string
  decodedPayload: unknown | null
}

interface AllMessagesResponse {
  messages: AllMessageItem[]
  total: number
  page: number
  size: number
}

interface DlqConfigMeta {
  id: string
  clusterId: string
  displayName: string
}

interface ClusterMeta {
  id: string
  name: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'DISCARDED', label: 'Discarded' },
  { value: 'REPLAYED', label: 'Replayed' },
  { value: 'REPLAY_FAILED', label: 'Replay Failed' },
]

const PAGE_SIZE = 50

function payloadPreview(msg: AllMessageItem): string {
  if (msg.decodedPayload) {
    const str = JSON.stringify(msg.decodedPayload)
    return str.length > 80 ? str.slice(0, 80) + '…' : str
  }
  return '—'
}

export default function AllMessagesPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [page, setPage] = useState(0)

  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterMeta[]>('/api/clusters'),
  })

  const allDlqQueries = useQuery({
    queryKey: ['all-dlq-meta', clusters.map(c => c.id)],
    queryFn: async () => {
      const all: DlqConfigMeta[] = []
      for (const cluster of clusters) {
        const configs = await apiFetch<DlqConfigMeta[]>(`/api/clusters/${cluster.id}/dlq-configs`)
        all.push(...configs)
      }
      return all
    },
    enabled: clusters.length > 0,
  })

  const clusterMap = Object.fromEntries(clusters.map(c => [c.id, c.name]))
  const configMap = Object.fromEntries((allDlqQueries.data ?? []).map(c => [c.id, c]))

  function buildParams() {
    const p = new URLSearchParams()
    if (appliedStatus) p.set('status', appliedStatus)
    p.set('page', String(page))
    p.set('size', String(PAGE_SIZE))
    return p.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['all-messages', appliedStatus, page],
    queryFn: () => apiFetch<AllMessagesResponse>(`/api/messages?${buildParams()}`),
  })

  const messages = data?.messages ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function applyFilter() {
    setPage(0)
    setAppliedStatus(statusFilter)
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="t-h1">All Messages</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status filter"
            style={{ width: 160 }}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={applyFilter}>Apply</button>
        </div>
      </div>

      {isLoading ? (
        <p className="t-small">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="t-small">No messages found.</p>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th>DLQ Config</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Part.</th>
                  <th>Offset</th>
                  <th>Payload preview</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const cfg = configMap[m.dlqConfigId]
                  const clusterName = cfg ? clusterMap[cfg.clusterId] ?? '—' : '—'
                  return (
                    <tr key={m.id} data-testid="all-message-row">
                      <td style={{ fontSize: 12 }}>{clusterName}</td>
                      <td style={{ fontSize: 12 }}>{cfg?.displayName ?? m.dlqConfigId.slice(0, 8)}</td>
                      <td><StatusBadge status={m.status} /></td>
                      <td style={{ fontSize: 12 }}>{new Date(m.kafkaTimestamp).toLocaleString()}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.partition}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.kafkaOffset}</td>
                      <td style={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: 'hsl(var(--muted-foreground))',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {payloadPreview(m)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/messages/${m.id}`} className="btn btn-ghost btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="t-small">{total} message{total !== 1 ? 's' : ''} total</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="t-small">{page + 1} / {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
