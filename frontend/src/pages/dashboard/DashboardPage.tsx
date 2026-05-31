import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

interface DashboardSummary {
  newCount: number
  underReviewCount: number
  replayedCount: number
  discardedCount: number
  replayFailedCount: number
  computedAt: string
}

interface SparklinePoint {
  date: string
  replayed: number
  total: number
  replayRate: number
}

interface DlqConfigItem {
  id: string
  clusterId: string
  displayName: string
}

interface ClusterItem {
  id: string
  name: string
}

const STATUS_CONFIG = [
  { key: 'newCount', label: 'New', color: 'var(--status-new)' },
  { key: 'underReviewCount', label: 'Under Review', color: 'var(--status-under-review)' },
  { key: 'replayedCount', label: 'Replayed', color: 'var(--status-replayed)' },
  { key: 'discardedCount', label: 'Discarded', color: 'var(--status-discarded)' },
  { key: 'replayFailedCount', label: 'Replay Failed', color: 'var(--status-replay-failed)' },
] as const

function SummaryCardSkeleton() {
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 12, width: 80, background: 'hsl(var(--muted))', borderRadius: 4 }} />
      <div style={{ height: 28, width: 60, background: 'hsl(var(--muted))', borderRadius: 4 }} />
    </div>
  )
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{count.toLocaleString()}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiFetch<DashboardSummary>('/api/dashboard/summary'),
  })

  const { data: sparkline = [], isLoading: loadingSparkline } = useQuery({
    queryKey: ['dashboard-sparkline'],
    queryFn: () => apiFetch<SparklinePoint[]>('/api/dashboard/sparkline?days=7'),
  })

  const { data: clusters = [], isLoading: loadingClusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterItem[]>('/api/clusters'),
  })

  const clusterIds = clusters.map(c => c.id)

  const dlqQueries = useQuery({
    queryKey: ['all-dlq-configs', clusterIds],
    queryFn: async () => {
      const all: (DlqConfigItem & { clusterName: string; newCount: number })[] = []
      for (const cluster of clusters) {
        const configs = await apiFetch<DlqConfigItem[]>(`/api/clusters/${cluster.id}/dlq-configs`)
        for (const cfg of configs) {
          const msgs = await apiFetch<{ total: number }>(`/api/dlq-configs/${cfg.id}/messages?status=NEW&size=1&page=0`)
          all.push({ ...cfg, clusterName: cluster.name, newCount: msgs.total })
        }
      }
      return all
    },
    enabled: clusters.length > 0,
  })

  const chartData = sparkline.map(p => ({
    date: p.date.slice(5),
    rate: Math.round(p.replayRate),
  }))

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="t-h1">Overview</h1>
        {summary && (
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            Last updated: {new Date(summary.computedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {loadingSummary || !summary
          ? STATUS_CONFIG.map(s => <SummaryCardSkeleton key={s.key} />)
          : STATUS_CONFIG.map(s => (
            <SummaryCard
              key={s.key}
              label={s.label}
              count={summary[s.key]}
              color={`hsl(${s.color})`}
            />
          ))
        }
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <p className="t-h4" style={{ marginBottom: 16 }}>Replay Rate — last 7 days</p>
          {loadingSparkline ? (
            <div style={{ height: 120, background: 'hsl(var(--muted))', borderRadius: 4 }} />
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`, 'Replay rate']} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  fill="url(#rateGrad)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <p className="t-h4" style={{ marginBottom: 12 }}>DLQ Status</p>
          {loadingClusters || dlqQueries.isLoading ? (
            <p className="t-small">Loading…</p>
          ) : dlqQueries.isError ? (
            <p className="t-small" style={{ color: 'hsl(var(--destructive))' }}>
              {(dlqQueries.error as Error)?.message ?? 'Failed to load DLQ configs'}
            </p>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 180 }}>
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>DLQ Config</th>
                    <th>Cluster</th>
                    <th style={{ textAlign: 'right' }}>NEW</th>
                  </tr>
                </thead>
                <tbody>
                  {(dlqQueries.data ?? []).map(cfg => (
                    <tr key={cfg.id}>
                      <td>
                        <Link
                          to={`/dlq-configs/${cfg.id}/messages`}
                          style={{ color: 'hsl(var(--primary))', textDecoration: 'none' }}
                        >
                          {cfg.displayName}
                        </Link>
                      </td>
                      <td style={{ color: 'hsl(var(--muted-foreground))' }}>{cfg.clusterName}</td>
                      <td style={{ textAlign: 'right', fontWeight: cfg.newCount > 0 ? 600 : 400 }}>
                        {cfg.newCount}
                      </td>
                    </tr>
                  ))}
                  {(dlqQueries.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                        No DLQ configs configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
