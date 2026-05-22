import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

const PROTOCOLS = [
  'PLAINTEXT',
  'SSL',
  'SASL_PLAIN',
  'SASL_SCRAM_SHA_256',
  'SASL_SCRAM_SHA_512',
] as const
type Protocol = (typeof PROTOCOLS)[number]

const SASL_PROTOCOLS: Protocol[] = [
  'SASL_PLAIN',
  'SASL_SCRAM_SHA_256',
  'SASL_SCRAM_SHA_512',
]

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  bootstrapServers: z.string().min(1, 'Bootstrap servers required'),
  securityProtocol: z.enum(PROTOCOLS),
  username: z.string().optional(),
  password: z.string().optional(),
  keystorePem: z.string().optional(),
  srUrl: z.string().optional(),
  srUsername: z.string().optional(),
  srPassword: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function CreateClusterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { securityProtocol: 'PLAINTEXT' },
  })
  const protocol = watch('securityProtocol')

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch('/api/clusters', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      toast.success('Cluster created')
      navigate('/clusters')
    },
    onError: (e: unknown) => {
      const err = e as { body?: { message?: string }; message?: string }
      toast.error(err.body?.message ?? err.message ?? 'Failed to create cluster')
    },
  })

  return (
    <div style={{ padding: 32, maxWidth: 480, margin: '0 auto' }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>Add Kafka Cluster</h1>

      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="name" style={{ fontSize: 12, fontWeight: 500 }}>Name</label>
            <input id="name" className={`input${errors.name ? ' error' : ''}`} {...register('name')} />
            {errors.name && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.name.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="bootstrapServers" style={{ fontSize: 12, fontWeight: 500 }}>Bootstrap Servers</label>
            <input
              id="bootstrapServers"
              className={`input${errors.bootstrapServers ? ' error' : ''}`}
              placeholder="host:9092"
              {...register('bootstrapServers')}
            />
            {errors.bootstrapServers && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.bootstrapServers.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="securityProtocol" style={{ fontSize: 12, fontWeight: 500 }}>Security Protocol</label>
            <select id="securityProtocol" className="select" {...register('securityProtocol')}>
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {SASL_PROTOCOLS.includes(protocol as Protocol) && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="username" style={{ fontSize: 12, fontWeight: 500 }}>Username</label>
                <input id="username" className="input" {...register('username')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="clusterPassword" style={{ fontSize: 12, fontWeight: 500 }}>Password</label>
                <input id="clusterPassword" type="password" className="input" {...register('password')} />
              </div>
            </>
          )}

          {protocol === 'SSL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="keystorePem" style={{ fontSize: 12, fontWeight: 500 }}>Keystore PEM</label>
              <input id="keystorePem" className="input" {...register('keystorePem')} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="srUrl" style={{ fontSize: 12, fontWeight: 500 }}>Schema Registry URL (optional)</label>
            <input
              id="srUrl"
              className="input"
              placeholder="http://localhost:8081"
              {...register('srUrl')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
            style={{ width: '100%', marginTop: 8, height: 34 }}
          >
            {mutation.isPending ? 'Saving…' : 'Save Cluster'}
          </button>
        </form>
      </div>
    </div>
  )
}
