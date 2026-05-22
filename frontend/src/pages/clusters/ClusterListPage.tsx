import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface ClusterResponse {
  id: string
  name: string
  bootstrapServers: string
  securityProtocol: string
  hasSchemaRegistry: boolean
}

export default function ClusterListPage() {
  const queryClient = useQueryClient()

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiFetch<ClusterResponse[]>('/api/clusters'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/clusters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      toast.success('Cluster deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="t-h1">Kafka Clusters</h1>
        <Link to="/clusters/new" className="btn btn-primary">Add Cluster</Link>
      </div>

      {isLoading ? (
        <p className="t-small">Loading…</p>
      ) : clusters.length === 0 ? (
        <p className="t-small">No clusters configured. Add one to get started.</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Bootstrap Servers</th>
                <th>Protocol</th>
                <th>Schema Registry</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      to={`/clusters/${c.id}/dlq-configs`}
                      style={{ fontWeight: 500, color: 'hsl(var(--foreground))', textDecoration: 'none' }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.bootstrapServers}</td>
                  <td>{c.securityProtocol}</td>
                  <td>{c.hasSchemaRegistry ? 'Yes' : 'No'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-destructive btn-sm"
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
