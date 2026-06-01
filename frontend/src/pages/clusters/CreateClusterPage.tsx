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

const SR_AUTH_MODES = ['none', 'basic'] as const
type SrAuthMode = (typeof SR_AUTH_MODES)[number]

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  bootstrapServers: z.string().min(1, 'Bootstrap servers required'),
  securityProtocol: z.enum(PROTOCOLS),
  tlsEnabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  keystorePem: z.string().optional(),
  truststorePem: z.string().optional(),
  srUrl: z.string().optional(),
  srAuthMode: z.enum(SR_AUTH_MODES).optional(),
  srUsername: z.string().optional(),
  srPassword: z.string().optional(),
  srTruststorePem: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function CreateClusterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { securityProtocol: 'PLAINTEXT', tlsEnabled: true, srAuthMode: 'none' },
  })
  const protocol = watch('securityProtocol')
  const tlsEnabled = watch('tlsEnabled')
  const srAuthMode = watch('srAuthMode') as SrAuthMode
  const srUrl = watch('srUrl') ?? ''
  const isSasl = SASL_PROTOCOLS.includes(protocol as Protocol)
  const showTruststore = protocol === 'SSL' || (isSasl && tlsEnabled)
  const showSrTruststore = srUrl.toLowerCase().startsWith('https://')

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = { ...data }
      if (payload.srAuthMode !== 'basic') {
        payload.srUsername = undefined
        payload.srPassword = undefined
      }
      return apiFetch('/api/clusters', { method: 'POST', body: JSON.stringify(payload) })
    },
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

          {isSasl && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="username" style={{ fontSize: 12, fontWeight: 500 }}>Username</label>
                <input id="username" className="input" {...register('username')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="clusterPassword" style={{ fontSize: 12, fontWeight: 500 }}>Password</label>
                <input id="clusterPassword" type="password" className="input" {...register('password')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id="tlsEnabled" type="checkbox" {...register('tlsEnabled')} />
                <label htmlFor="tlsEnabled" style={{ fontSize: 12, fontWeight: 500 }}>Enable TLS (SASL_SSL)</label>
              </div>
            </>
          )}

          {protocol === 'SSL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="keystorePem" style={{ fontSize: 12, fontWeight: 500 }}>Keystore PEM (client cert for mTLS)</label>
              <textarea id="keystorePem" className="input" rows={4}
                style={{ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                {...register('keystorePem')} />
            </div>
          )}

          {showTruststore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="truststorePem" style={{ fontSize: 12, fontWeight: 500 }}>
                CA Certificate PEM (optional — leave blank for public CA brokers)
              </label>
              <textarea id="truststorePem" className="input" rows={4}
                style={{ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                {...register('truststorePem')} />
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="srAuthMode" style={{ fontSize: 12, fontWeight: 500 }}>Schema Registry Auth</label>
            <select id="srAuthMode" className="select" {...register('srAuthMode')}>
              <option value="none">None</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>

          {srAuthMode === 'basic' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="srUsername" style={{ fontSize: 12, fontWeight: 500 }}>Schema Registry Username</label>
                <input id="srUsername" className="input" {...register('srUsername')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="srPassword" style={{ fontSize: 12, fontWeight: 500 }}>Schema Registry Password</label>
                <input id="srPassword" type="password" className="input" {...register('srPassword')} />
              </div>
            </>
          )}

          {showSrTruststore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="srTruststorePem" style={{ fontSize: 12, fontWeight: 500 }}>
                Schema Registry CA Certificate PEM (optional — leave blank for public CA)
              </label>
              <textarea id="srTruststorePem" className="input" rows={4}
                style={{ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                {...register('srTruststorePem')} />
            </div>
          )}

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
