import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'

interface MessageSummary {
  id: string
  dlqConfigId: string
  partition: number
  kafkaOffset: number
  kafkaTimestamp: string
  status: string
  schemaDecodeFailed: boolean
  schemaId: number | null
  ingestedAt: string
}

interface MessagePageResponse {
  messages: MessageSummary[]
  total: number
  page: number
  size: number
}

const PAGE_SIZE = 20

export default function MessageListPage() {
  const { configId } = useParams<{ configId: string }>()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [partitionFilter, setPartitionFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    status: 'ALL', from: '', to: '', partition: '',
  })
  const [page, setPage] = useState(0)

  function buildParams() {
    const p = new URLSearchParams()
    if (appliedFilters.status && appliedFilters.status !== 'ALL') p.set('status', appliedFilters.status)
    if (appliedFilters.from) p.set('from', new Date(appliedFilters.from).toISOString())
    if (appliedFilters.to) p.set('to', new Date(appliedFilters.to).toISOString())
    if (appliedFilters.partition) p.set('partition', appliedFilters.partition)
    p.set('page', String(page))
    p.set('size', String(PAGE_SIZE))
    return p.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['messages', configId, appliedFilters, page],
    queryFn: () =>
      apiFetch<MessagePageResponse>(
        `/api/dlq-configs/${configId}/messages?${buildParams()}`
      ),
    enabled: !!configId,
  })

  function applyFilters() {
    setPage(0)
    setAppliedFilters({
      status: statusFilter,
      from: fromFilter,
      to: toFilter,
      partition: partitionFilter,
    })
    queryClient.invalidateQueries({ queryKey: ['messages', configId] })
  }

  const messages = data?.messages ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div style={{ padding: 32 }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>Messages</h1>

      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label htmlFor="status-filter" style={{ fontSize: 12, fontWeight: 500 }}>Status</label>
          <select
            id="status-filter"
            aria-label="Status"
            className="select"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="NEW">New</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="DISCARDED">Discarded</option>
            <option value="REPLAYED">Replayed</option>
            <option value="REPLAY_FAILED">Replay Failed</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="from-filter" style={{ fontSize: 12, fontWeight: 500 }}>From</label>
          <input
            id="from-filter"
            type="date"
            className="input"
            style={{ width: 160 }}
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="to-filter" style={{ fontSize: 12, fontWeight: 500 }}>To</label>
          <input
            id="to-filter"
            type="date"
            className="input"
            style={{ width: 160 }}
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="partition-filter" style={{ fontSize: 12, fontWeight: 500 }}>Partition</label>
          <input
            id="partition-filter"
            type="number"
            min={0}
            className="input"
            style={{ width: 96 }}
            value={partitionFilter}
            onChange={(e) => setPartitionFilter(e.target.value)}
            placeholder="Any"
          />
        </div>

        <button className="btn btn-secondary" onClick={applyFilters}>Apply Filters</button>
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
                  <th>Partition</th>
                  <th>Offset</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Schema</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} data-testid="message-row">
                    <td style={{ fontFamily: 'monospace' }}>{m.partition}</td>
                    <td style={{ fontFamily: 'monospace' }}>{m.kafkaOffset}</td>
                    <td>{new Date(m.kafkaTimestamp).toLocaleString()}</td>
                    <td>
                      <StatusBadge status={m.status} testId="status-badge" />
                    </td>
                    <td>
                      {m.schemaDecodeFailed && (
                        <span className="badge" style={{ background: 'hsl(var(--warning-muted))', color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning) / 0.3)' }}>
                          Decode Failed
                        </span>
                      )}
                      {m.schemaId && !m.schemaDecodeFailed && (
                        <span className="t-small">schema #{m.schemaId}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/messages/${m.id}`} className="btn btn-ghost btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="t-small">
              {total} message{total !== 1 ? 's' : ''} total
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="t-small">{page + 1} / {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
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
