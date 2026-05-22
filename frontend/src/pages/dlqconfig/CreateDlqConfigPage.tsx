import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

const schema = z.object({
  topicName: z.string().min(1, 'Topic name required'),
  displayName: z.string().min(1, 'Display name required'),
  downloadMode: z.enum(['SCHEDULED', 'ON_DEMAND', 'BOTH']),
  cronExpression: z.string().optional(),
  batchSize: z.number().min(1).max(10000),
  retentionType: z.enum(['MAX_AGE_DAYS', 'MAX_COUNT']),
  retentionValue: z.number().min(1),
})
type FormValues = z.infer<typeof schema>

export default function CreateDlqConfigPage() {
  const { clusterId } = useParams<{ clusterId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      downloadMode: 'ON_DEMAND',
      batchSize: 100,
      retentionType: 'MAX_AGE_DAYS',
      retentionValue: 30,
    },
  })
  const downloadMode = watch('downloadMode')
  const retentionType = watch('retentionType')

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch(`/api/clusters/${clusterId}/dlq-configs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-configs', clusterId] })
      toast.success('DLQ config created')
      navigate(`/clusters/${clusterId}/dlq-configs`)
    },
    onError: (e: unknown) => {
      const err = e as { body?: { message?: string }; message?: string }
      toast.error(err.body?.message ?? err.message ?? 'Failed to create DLQ config')
    },
  })

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>Add DLQ Config</h1>

      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="topicName" style={{ fontSize: 12, fontWeight: 500 }}>Topic Name</label>
            <input
              id="topicName"
              className={`input${errors.topicName ? ' error' : ''}`}
              placeholder="my-service.dlq"
              {...register('topicName')}
            />
            {errors.topicName && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.topicName.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="displayName" style={{ fontSize: 12, fontWeight: 500 }}>Display Name</label>
            <input
              id="displayName"
              className={`input${errors.displayName ? ' error' : ''}`}
              {...register('displayName')}
            />
            {errors.displayName && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.displayName.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="downloadMode" style={{ fontSize: 12, fontWeight: 500 }}>Download Mode</label>
            <select id="downloadMode" className="select" {...register('downloadMode')}>
              <option value="ON_DEMAND">On Demand</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="BOTH">Both</option>
            </select>
          </div>

          {(downloadMode === 'SCHEDULED' || downloadMode === 'BOTH') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="cronExpression" style={{ fontSize: 12, fontWeight: 500 }}>Cron Expression</label>
              <input
                id="cronExpression"
                className="input"
                placeholder="0 */5 * * * ?"
                {...register('cronExpression')}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="batchSize" style={{ fontSize: 12, fontWeight: 500 }}>Batch Size</label>
            <input id="batchSize" type="number" className="input" {...register('batchSize', { valueAsNumber: true })} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="retentionType" style={{ fontSize: 12, fontWeight: 500 }}>Retention Type</label>
            <select id="retentionType" className="select" {...register('retentionType')}>
              <option value="MAX_AGE_DAYS">Max Age (days)</option>
              <option value="MAX_COUNT">Max Count</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="retentionValue" style={{ fontSize: 12, fontWeight: 500 }}>
              {retentionType === 'MAX_AGE_DAYS' ? 'Max Days' : 'Max Messages'}
            </label>
            <input id="retentionValue" type="number" className="input" {...register('retentionValue', { valueAsNumber: true })} />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
            style={{ width: '100%', marginTop: 8, height: 34 }}
          >
            {mutation.isPending ? 'Saving…' : 'Save DLQ Config'}
          </button>
        </form>
      </div>
    </div>
  )
}
