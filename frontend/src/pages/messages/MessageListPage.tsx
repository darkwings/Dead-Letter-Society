import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import RouteGuard from '@/components/RouteGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  DISCARDED: 'bg-gray-100 text-gray-600',
  REPLAYED: 'bg-green-100 text-green-800',
  REPLAY_FAILED: 'bg-red-100 text-red-800',
}

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
    <RouteGuard>
      <div className="p-8">
        <h1 className="t-h1 mb-6">Messages</h1>

        {/* Filter panel */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-card">
          <div className="flex flex-col gap-1 min-w-36">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="DISCARDED">Discarded</SelectItem>
                <SelectItem value="REPLAYED">Replayed</SelectItem>
                <SelectItem value="REPLAY_FAILED">Replay Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="from-filter">From</Label>
            <Input
              id="from-filter"
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to-filter">To</Label>
            <Input
              id="to-filter"
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="partition-filter">Partition</Label>
            <Input
              id="partition-filter"
              type="number"
              min={0}
              value={partitionFilter}
              onChange={(e) => setPartitionFilter(e.target.value)}
              placeholder="Any"
              className="w-24"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={applyFilters}>Apply Filters</Button>
          </div>
        </div>

        {isLoading ? (
          <p className="t-small">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="t-small text-muted-foreground">No messages found.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partition</TableHead>
                  <TableHead>Offset</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id} data-testid="message-row">
                    <TableCell className="font-mono">{m.partition}</TableCell>
                    <TableCell className="font-mono">{m.kafkaOffset}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(m.kafkaTimestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span
                        data-testid="status-badge"
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[m.status] ?? ''}`}
                      >
                        {m.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {m.schemaDecodeFailed && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Decode Failed
                        </span>
                      )}
                      {m.schemaId && !m.schemaDecodeFailed && (
                        <span className="text-xs text-muted-foreground">
                          schema #{m.schemaId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/messages/${m.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="t-small text-muted-foreground">
                {total} message{total !== 1 ? 's' : ''} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center text-sm px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  )
}
