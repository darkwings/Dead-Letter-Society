import { useCallback, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSSE } from '@/hooks/useSSE'

interface ClusterResponse {
  id: string
  name: string
  bootstrapServers: string
  securityProtocol: string
  hasSchemaRegistry: boolean
}

interface DlqConfigResponse {
  id: string
  clusterId: string
  topicName: string
  displayName: string
  downloadMode: string
}

const Chevron = ({ down }: { down: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, transition: 'transform 120ms', transform: down ? 'rotate(0deg)' : 'rotate(-90deg)' }}
  >
    <path d="m2 3.5 3 3 3-3" />
  </svg>
)

function DlqBadge({ configId }: { configId: string }) {
  const { data } = useQuery({
    queryKey: ['dlq-badge', configId],
    queryFn: () => apiFetch<{ total: number }>(`/api/dlq-configs/${configId}/messages?status=NEW&size=0&page=0`),
    staleTime: 30_000,
  })
  const count = data?.total ?? 0
  if (count > 0) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, lineHeight: 1,
        padding: '2px 5px', borderRadius: 8,
        background: 'hsl(var(--status-new-bg, var(--status-new) / 0.15))',
        color: 'hsl(var(--status-new))',
        minWidth: 18, textAlign: 'center',
      }}>
        {count > 99 ? '99+' : count}
      </span>
    )
  }
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: 'hsl(var(--muted-foreground) / 0.3)',
      flexShrink: 0,
    }} />
  )
}

function ClusterNavItem({ cluster, defaultExpanded }: { cluster: ClusterResponse; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const location = useLocation()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['dlq-configs', cluster.id],
    queryFn: () => apiFetch<DlqConfigResponse[]>(`/api/clusters/${cluster.id}/dlq-configs`),
    enabled: expanded,
  })

  const isClusterActive = location.pathname.startsWith(`/clusters/${cluster.id}`)

  return (
    <div style={{ marginBottom: 1 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '6px 10px', background: isClusterActive ? 'hsl(var(--accent))' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          color: isClusterActive ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
          fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500,
          borderRadius: 'var(--radius)',
        }}
      >
        <Chevron down={expanded} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.005 }}>
          {cluster.name}
        </span>
      </button>

      {expanded && (
        <div style={{ marginLeft: 16, borderLeft: '1px solid hsl(var(--border))', marginBottom: 4 }}>
          {isLoading ? (
            <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              Loading…
            </span>
          ) : configs.length === 0 ? (
            <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              No DLQ configs.
            </span>
          ) : (
            configs.map((cfg) => {
              const active = location.pathname.startsWith(`/dlq-configs/${cfg.id}`)
              return (
                <Link
                  key={cfg.id}
                  to={`/dlq-configs/${cfg.id}/messages`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px',
                    fontSize: 12, textDecoration: 'none',
                    color: active ? 'hsl(var(--accent-foreground))' : 'hsl(var(--muted-foreground))',
                    background: active ? 'hsl(var(--accent))' : 'transparent',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cfg.displayName}
                  </span>
                  <DlqBadge configId={cfg.id} />
                </Link>
              )
            })
          )}
          <Link
            to={`/clusters/${cluster.id}/dlq-configs/new`}
            style={{
              display: 'block', padding: '4px 10px', fontSize: 11,
              color: 'hsl(var(--primary))', textDecoration: 'none',
            }}
          >
            + Add DLQ Config
          </Link>
        </div>
      )}
    </div>
  )
}

interface MyDlqConfig {
  id: string
  displayName: string
}

function UserDlqNav() {
  const location = useLocation()
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['my-dlq-configs'],
    queryFn: () => apiFetch<MyDlqConfig[]>('/api/dlq-configs/my'),
  })

  if (isLoading) {
    return <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Loading…</span>
  }
  if (configs.length === 0) {
    return <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>No DLQ configs assigned yet.</span>
  }
  return (
    <>
      {configs.map((cfg) => {
        const active = location.pathname.startsWith(`/dlq-configs/${cfg.id}`)
        return (
          <Link
            key={cfg.id}
            to={`/dlq-configs/${cfg.id}/messages`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', fontSize: 12.5, fontWeight: 500,
              textDecoration: 'none',
              color: active ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
              background: active ? 'hsl(var(--accent))' : 'transparent',
              borderRadius: 'var(--radius)',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cfg.displayName}
            </span>
            <DlqBadge configId={cfg.id} />
          </Link>
        )
      })}
    </>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.globalRole === 'ADMIN'
  const queryClient = useQueryClient()

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterResponse[]>('/api/clusters'),
    enabled: isAdmin,
  })

  const onSseEvent = useCallback(
    (event: { type: string; data?: Record<string, unknown> }) => {
      if (event.type === 'MESSAGE_STATUS_CHANGED' && event.data?.dlqConfigId) {
        queryClient.invalidateQueries({
          queryKey: ['dlq-badge', event.data.dlqConfigId as string],
        })
      }
      if (event.type === 'FETCH_COMPLETED' && event.data?.dlqConfigId) {
        queryClient.invalidateQueries({
          queryKey: ['dlq-badge', event.data.dlqConfigId as string],
        })
      }
    },
    [queryClient],
  )
  useSSE(onSseEvent)

  const globalNav = [
    { to: isAdmin ? '/dashboard' : '/messages', label: 'Overview' },
    { to: '/messages', label: 'All Messages' },
  ]

  return (
    <nav
      style={{
        width: 220, flexShrink: 0,
        background: 'hsl(var(--card))',
        borderRight: '1px solid hsl(var(--border))',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 6px 0' }}>
        {globalNav.map(({ to, label }) => {
          const active = location.pathname === to
          return (
            <NavLink
              key={label}
              to={to}
              style={{
                display: 'block', padding: '6px 10px', fontSize: 12.5, fontWeight: 500,
                color: active ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
                background: active ? 'hsl(var(--accent))' : 'transparent',
                textDecoration: 'none', borderRadius: 'var(--radius)', marginBottom: 2,
              }}
            >
              {label}
            </NavLink>
          )
        })}
        <div style={{ height: 1, background: 'hsl(var(--border))', margin: '8px 4px' }} />
        <p className="t-h4" style={{ padding: '0 6px', marginBottom: 8 }}>DLQ Configs</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }} className="scroll">
        {isAdmin ? (
          isLoading ? (
            <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              Loading…
            </span>
          ) : clusters.length === 0 ? (
            <span style={{ display: 'block', padding: '4px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              No clusters yet.
            </span>
          ) : (
            clusters.map((c, i) => (
              <ClusterNavItem key={c.id} cluster={c} defaultExpanded={i === 0} />
            ))
          )
        ) : (
          <UserDlqNav />
        )}
      </div>

      {isAdmin && (
        <div style={{ padding: '8px 6px', borderTop: '1px solid hsl(var(--border))' }}>
          <p className="t-h4" style={{ padding: '0 6px', marginBottom: 6 }}>Admin</p>
          {([
            { to: '/clusters', label: 'Clusters' },
            { to: '/admin/users', label: 'Users' },
            { to: '/settings', label: 'Settings' },
          ] as const).map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/')
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'block', padding: '6px 10px', fontSize: 12.5, fontWeight: 500,
                  color: active ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
                  background: active ? 'hsl(var(--accent))' : 'transparent',
                  textDecoration: 'none', borderRadius: 'var(--radius)',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
