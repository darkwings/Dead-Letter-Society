import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/stores/authStore'

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
  decodedPayload: unknown | null
  headers: Record<string, string>
  failureInfo?: { originalTopic: string | null }
}

interface MessagePageResponse {
  messages: MessageSummary[]
  total: number
  page: number
  size: number
}

interface DlqConfigDetail {
  id: string
  clusterId: string
  displayName: string
  defaultReplayTopic: string | null
}

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'DISCARDED', label: 'Discarded' },
  { value: 'REPLAYED', label: 'Replayed' },
  { value: 'REPLAY_FAILED', label: 'Replay Failed' },
]

const CHIP_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  ALL:          { color: 'hsl(var(--primary))',            bg: 'hsl(var(--primary-muted))',         border: 'hsl(var(--primary) / 0.45)' },
  NEW:          { color: 'hsl(var(--status-new))',         bg: 'hsl(var(--status-new-bg))',          border: 'hsl(var(--status-new) / 0.45)' },
  UNDER_REVIEW: { color: 'hsl(var(--status-under-review))', bg: 'hsl(var(--status-under-review-bg))', border: 'hsl(var(--status-under-review) / 0.45)' },
  REPLAYED:     { color: 'hsl(var(--status-replayed))',    bg: 'hsl(var(--status-replayed-bg))',     border: 'hsl(var(--status-replayed) / 0.45)' },
  DISCARDED:    { color: 'hsl(var(--status-discarded))',   bg: 'hsl(var(--status-discarded-bg))',    border: 'hsl(var(--status-discarded) / 0.35)' },
  REPLAY_FAILED:{ color: 'hsl(var(--status-replay-failed))', bg: 'hsl(var(--status-replay-failed-bg))', border: 'hsl(var(--status-replay-failed) / 0.45)' },
}

function payloadPreview(msg: MessageSummary): string {
  if (msg.decodedPayload) {
    const str = JSON.stringify(msg.decodedPayload)
    return str.length > 80 ? str.slice(0, 80) + '…' : str
  }
  return '—'
}

export default function MessageListPage() {
  const { configId } = useParams<{ configId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isOperator = user?.globalRole === 'ADMIN'

  const { data: configData } = useQuery({
    queryKey: ['dlq-config', configId],
    queryFn: () => apiFetch<DlqConfigDetail>(`/api/dlq-configs/${configId}`),
    enabled: !!configId,
  })

  const fetchMutation = useMutation({
    mutationFn: () => apiFetch<{ fetched: number }>(`/api/dlq-configs/${configId}/fetch`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', configId] })
      queryClient.invalidateQueries({ queryKey: ['dlq-badge', configId] })
      toast.success(`Fetched ${data.fetched} new message${data.fetched !== 1 ? 's' : ''}`)
    },
    onError: (e: unknown) => {
      const err = e as { status?: number; body?: { message?: string }; message?: string }
      if (err.status === 409) {
        toast.info('A fetch is already in progress.')
      } else {
        toast.error(err.body?.message ?? err.message ?? 'Fetch failed')
      }
    },
  })

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [partitionFilter, setPartitionFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ status: 'ALL', from: '', to: '', partition: '' })
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    queryFn: () => apiFetch<MessagePageResponse>(`/api/dlq-configs/${configId}/messages?${buildParams()}`),
    enabled: !!configId,
  })

  function applyFilters() {
    setPage(0)
    setSelectedIds(new Set())
    setAppliedFilters({ status: statusFilter, from: fromFilter, to: toFilter, partition: partitionFilter })
    queryClient.invalidateQueries({ queryKey: ['messages', configId] })
  }

  function clearFilters() {
    setStatusFilter('ALL')
    setFromFilter('')
    setToFilter('')
    setPartitionFilter('')
    setPage(0)
    setSelectedIds(new Set())
    setAppliedFilters({ status: 'ALL', from: '', to: '', partition: '' })
  }

  const messages = data?.messages ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const allPageSelected = messages.length > 0 && messages.every(m => selectedIds.has(m.id))

  function toggleAll() {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        messages.forEach(m => next.delete(m.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        messages.forEach(m => next.add(m.id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedMessages = messages.filter(m => selectedIds.has(m.id))
  const [bulkTopicOverride, setBulkTopicOverride] = useState('')
  const noTopicKnown = !bulkTopicOverride.trim() && configData?.defaultReplayTopic == null &&
    selectedMessages.length > 0 && !selectedMessages.some(m => !!m.failureInfo?.originalTopic)

  const bulkReplayMutation = useMutation({
    mutationFn: () => apiFetch<{ succeeded: number; failed: number }>(
      `/api/dlq-configs/${configId}/messages/bulk-replay`,
      { method: 'POST', body: JSON.stringify({
        messageIds: [...selectedIds],
        targetTopicOverride: bulkTopicOverride.trim() || undefined,
      }) }
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages', configId] })
      queryClient.invalidateQueries({ queryKey: ['dlq-badge', configId] })
      setSelectedIds(new Set())
      setBulkTopicOverride('')
      if (result.failed === 0) {
        toast.success(`${result.succeeded} message${result.succeeded !== 1 ? 's' : ''} replayed`)
      } else {
        toast.warning(`${result.succeeded} replayed, ${result.failed} failed`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkDiscardMutation = useMutation({
    mutationFn: () => apiFetch<{ succeeded: number; failed: number }>(
      `/api/dlq-configs/${configId}/messages/bulk-discard`,
      { method: 'POST', body: JSON.stringify({ messageIds: [...selectedIds] }) }
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages', configId] })
      queryClient.invalidateQueries({ queryKey: ['dlq-badge', configId] })
      setSelectedIds(new Set())
      if (result.failed === 0) {
        toast.success(`${result.succeeded} message${result.succeeded !== 1 ? 's' : ''} discarded`)
      } else {
        toast.warning(`${result.succeeded} discarded, ${result.failed} failed`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkUnderReviewMutation = useMutation({
    mutationFn: () => apiFetch<{ succeeded: number; failed: number }>(
      `/api/dlq-configs/${configId}/messages/bulk-under-review`,
      { method: 'POST', body: JSON.stringify({ messageIds: [...selectedIds] }) }
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages', configId] })
      setSelectedIds(new Set())
      if (result.failed === 0) {
        toast.success(`${result.succeeded} message${result.succeeded !== 1 ? 's' : ''} marked Under Review`)
      } else {
        toast.warning(`${result.succeeded} marked Under Review, ${result.failed} failed`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const hasPendingChanges =
    fromFilter !== appliedFilters.from ||
    toFilter !== appliedFilters.to ||
    partitionFilter !== appliedFilters.partition

  const activeDatePartitionCount = [
    appliedFilters.status !== 'ALL',
    !!appliedFilters.from,
    !!appliedFilters.to,
    !!appliedFilters.partition,
  ].filter(Boolean).length

  function setStatusImmediate(value: string) {
    setStatusFilter(value)
    setPage(0)
    setSelectedIds(new Set())
    setAppliedFilters(prev => ({ ...prev, status: value }))
  }

  return (
    <div style={{ padding: 32, display: 'flex', gap: 20 }}>
      {/* Filter panel */}
      <aside style={{
        width: 220, flexShrink: 0,
        position: 'sticky', top: 0, alignSelf: 'flex-start',
      }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="t-h4" style={{ margin: 0 }}>Filters</p>
            {activeDatePartitionCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 8,
                background: 'hsl(var(--primary-muted))',
                color: 'hsl(var(--primary))',
              }}>
                {activeDatePartitionCount} active
              </span>
            )}
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Date range</label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>From</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="datetime-local"
                  className="input"
                  value={fromFilter}
                  onChange={(e) => setFromFilter(e.target.value)}
                  style={{ width: '100%', paddingRight: fromFilter ? 28 : undefined, colorScheme: 'dark' }}
                />
                {fromFilter && (
                  <button
                    onClick={() => setFromFilter('')}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))', fontSize: 14, lineHeight: 1, padding: 2,
                    }}
                    aria-label="Clear from date"
                  >×</button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>To</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="datetime-local"
                  className="input"
                  value={toFilter}
                  onChange={(e) => setToFilter(e.target.value)}
                  style={{ width: '100%', paddingRight: toFilter ? 28 : undefined, colorScheme: 'dark' }}
                />
                {toFilter && (
                  <button
                    onClick={() => setToFilter('')}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))', fontSize: 14, lineHeight: 1, padding: 2,
                    }}
                    aria-label="Clear to date"
                  >×</button>
                )}
              </div>
            </div>

            {!fromFilter && !toFilter && (
              <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', margin: 0 }}>No date filter set</p>
            )}
          </div>

          <div style={{ height: 1, background: 'hsl(var(--border))' }} />

          {/* Partition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="partition-filter" style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Partition</label>
            <input
              id="partition-filter"
              type="number"
              min={0}
              className="input"
              value={partitionFilter}
              onChange={(e) => setPartitionFilter(e.target.value)}
              placeholder="All partitions"
            />
          </div>

          <button
            className={hasPendingChanges ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ height: 32 }}
            onClick={applyFilters}
            disabled={!hasPendingChanges}
          >
            {hasPendingChanges ? 'Apply filters' : 'Filters applied'}
          </button>
          {activeDatePartitionCount > 0 && (
            <button className="btn btn-ghost" style={{ height: 28, fontSize: 11 }} onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 className="t-h1">{configData?.displayName ?? 'Messages'}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOperator && configData?.clusterId && (
              <Link
                to={`/clusters/${configData.clusterId}/dlq-configs/${configId}/edit`}
                className="btn btn-secondary"
              >
                Edit Config
              </Link>
            )}
            {isOperator && selectedIds.size > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input
                    data-testid="bulk-topic-override"
                    className="input"
                    placeholder="Target topic (optional)"
                    value={bulkTopicOverride}
                    onChange={(e) => setBulkTopicOverride(e.target.value)}
                    style={{ height: 32, width: 220 }}
                  />
                  {noTopicKnown && (
                    <span data-testid="bulk-no-topic-hint" style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                      No replay topic found for the selection. Enter one, or these messages will be skipped.
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={bulkUnderReviewMutation.isPending || bulkDiscardMutation.isPending || bulkReplayMutation.isPending}
                  onClick={() => bulkUnderReviewMutation.mutate()}
                >
                  {bulkUnderReviewMutation.isPending ? 'Updating…' : `Under Review (${selectedIds.size} selected)`}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={bulkDiscardMutation.isPending || bulkReplayMutation.isPending || bulkUnderReviewMutation.isPending}
                  onClick={() => bulkDiscardMutation.mutate()}
                >
                  {bulkDiscardMutation.isPending ? 'Discarding…' : `Discard (${selectedIds.size} selected)`}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={bulkReplayMutation.isPending || bulkDiscardMutation.isPending || bulkUnderReviewMutation.isPending}
                  onClick={() => bulkReplayMutation.mutate()}
                >
                  {bulkReplayMutation.isPending ? 'Replaying…' : `Replay (${selectedIds.size} selected)`}
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => fetchMutation.mutate()}
              disabled={fetchMutation.isPending}
            >
              {fetchMutation.isPending ? 'Fetching…' : 'Fetch now'}
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(o => {
            const c = CHIP_COLORS[o.value]
            const active = appliedFilters.status === o.value
            return (
              <button
                key={o.value}
                onClick={() => setStatusImmediate(o.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: active ? `1px solid ${c.border}` : '1px solid hsl(var(--border))',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? c.bg : 'transparent',
                  color: active ? c.color : 'hsl(var(--muted-foreground))',
                }}
              >
                {o.label}
              </button>
            )
          })}
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
                    {isOperator && (
                      <th style={{ width: 32, padding: '0 8px' }}>
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th>Partition</th>
                    <th>Offset</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Payload preview</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id} data-testid="message-row">
                      {isOperator && (
                        <td style={{ width: 32, padding: '0 8px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(m.id)}
                            onChange={() => toggleOne(m.id)}
                            aria-label={`Select message ${m.id}`}
                          />
                        </td>
                      )}
                      <td style={{ fontFamily: 'monospace' }}>{m.partition}</td>
                      <td style={{ fontFamily: 'monospace' }}>{m.kafkaOffset}</td>
                      <td>{new Date(m.kafkaTimestamp).toLocaleString()}</td>
                      <td>
                        <StatusBadge status={m.status} testId="status-badge" />
                      </td>
                      <td style={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: 'hsl(var(--muted-foreground))',
                        maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {payloadPreview(m)}
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
                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
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
    </div>
  )
}
