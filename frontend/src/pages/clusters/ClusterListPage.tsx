import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import RouteGuard from '@/components/RouteGuard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    <RouteGuard>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="t-h1">Kafka Clusters</h1>
          <Button asChild>
            <Link to="/clusters/new">Add Cluster</Link>
          </Button>
        </div>
        {isLoading ? (
          <p className="t-small">Loading...</p>
        ) : clusters.length === 0 ? (
          <p className="t-small text-muted-foreground">
            No clusters configured. Add one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Bootstrap Servers</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Schema Registry</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      to={`/clusters/${c.id}/dlq-configs`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.bootstrapServers}</TableCell>
                  <TableCell>{c.securityProtocol}</TableCell>
                  <TableCell>{c.hasSchemaRegistry ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </RouteGuard>
  )
}
