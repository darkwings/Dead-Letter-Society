import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface DlqConfigResponse {
  id: string
  clusterId: string
  topicName: string
  displayName: string
  downloadMode: string
  batchSize: number
  retentionType: string
  retentionValue: number
}

export default function DlqConfigListPage() {
  const { clusterId } = useParams<{ clusterId: string }>()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['dlq-configs', clusterId],
    queryFn: () => apiFetch<DlqConfigResponse[]>(`/api/clusters/${clusterId}/dlq-configs`),
    enabled: !!clusterId,
  })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="t-h1">DLQ Configs</h1>
        <Link to={`/clusters/${clusterId}/dlq-configs/new`} className="btn btn-primary">
          Add DLQ Config
        </Link>
      </div>

      {isLoading ? (
        <p className="t-small">Loading…</p>
      ) : configs.length === 0 ? (
        <p className="t-small">No DLQ configs yet.</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Topic</th>
                <th>Download Mode</th>
                <th>Retention</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.displayName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.topicName}</td>
                  <td>{c.downloadMode}</td>
                  <td className="t-small">
                    {c.retentionValue} {c.retentionType === 'MAX_AGE_DAYS' ? 'days' : 'messages'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/dlq-configs/${c.id}/messages`}
                      className="btn btn-secondary btn-sm"
                    >
                      View Messages
                    </Link>
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
