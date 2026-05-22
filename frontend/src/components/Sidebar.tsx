import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

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
                    display: 'block', padding: '5px 10px',
                    fontSize: 12, textDecoration: 'none',
                    color: active ? 'hsl(var(--accent-foreground))' : 'hsl(var(--muted-foreground))',
                    background: active ? 'hsl(var(--accent))' : 'transparent',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {cfg.displayName}
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

export default function Sidebar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.globalRole === 'ADMIN'

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterResponse[]>('/api/clusters'),
  })

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
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 6px 6px' }} className="scroll">
        <p className="t-h4" style={{ padding: '0 6px', marginBottom: 8 }}>DLQ Configs</p>

        {isLoading ? (
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
        )}
      </div>

      {isAdmin && (
        <div style={{ padding: '8px 6px', borderTop: '1px solid hsl(var(--border))' }}>
          <p className="t-h4" style={{ padding: '0 6px', marginBottom: 6 }}>Admin</p>
          <Link
            to="/admin/users"
            style={{
              display: 'block', padding: '6px 10px', fontSize: 12.5, fontWeight: 500,
              color: location.pathname.startsWith('/admin/users') ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
              background: location.pathname.startsWith('/admin/users') ? 'hsl(var(--accent))' : 'transparent',
              textDecoration: 'none', borderRadius: 'var(--radius)',
            }}
          >
            Users
          </Link>
        </div>
      )}
    </nav>
  )
}
