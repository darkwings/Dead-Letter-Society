import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch, ApiError } from '@/lib/api'
import { useEffect } from 'react'

interface DlqConfigDetail {
  id: string
  clusterId: string
  topicName: string
  displayName: string
  downloadMode: 'SCHEDULED' | 'ON_DEMAND' | 'BOTH'
  cronExpression: string | null
  batchSize: number
  retentionType: 'MAX_AGE_DAYS' | 'MAX_COUNT'
  retentionValue: number
  defaultReplayTopic: string | null
}

const schema = z.object({
  displayName: z.string().min(1, 'Display name required'),
  downloadMode: z.enum(['SCHEDULED', 'ON_DEMAND', 'BOTH']),
  cronExpression: z.string().optional(),
  batchSize: z.number().min(1).max(10000),
  retentionType: z.enum(['MAX_AGE_DAYS', 'MAX_COUNT']),
  retentionValue: z.number().min(1),
  defaultReplayTopic: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function EditDlqConfigPage() {
  const { clusterId, configId } = useParams<{ clusterId: string; configId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['dlq-config', configId],
    queryFn: () => apiFetch<DlqConfigDetail>(`/api/dlq-configs/${configId}`),
    enabled: !!configId,
  })

  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (config) {
      reset({
        displayName: config.displayName,
        downloadMode: config.downloadMode,
        cronExpression: config.cronExpression ?? '',
        batchSize: config.batchSize,
        retentionType: config.retentionType,
        retentionValue: config.retentionValue,
        defaultReplayTopic: config.defaultReplayTopic ?? '',
      })
    }
  }, [config, reset])

  const downloadMode = watch('downloadMode')
  const retentionType = watch('retentionType')

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const body = {
        ...data,
        cronExpression: data.cronExpression?.trim() || null,
        defaultReplayTopic: data.defaultReplayTopic?.trim() || null,
      }
      return apiFetch(`/api/clusters/${clusterId}/dlq-configs/${configId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-configs', clusterId] })
      queryClient.invalidateQueries({ queryKey: ['dlq-config', configId] })
      toast.success('DLQ config updated')
      navigate(`/clusters/${clusterId}/dlq-configs`)
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.violations) {
        e.violations.forEach(({ field, message }) => {
          setError(field as keyof FormValues, { message })
        })
        toast.error('Please fix the validation errors')
      } else {
        const err = e as { message?: string }
        toast.error(err.message ?? 'Failed to update DLQ config')
      }
    },
  })

  if (isLoading) {
    return <div style={{ padding: 32 }}><p className="t-small">Loading…</p></div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 480, margin: '0 auto' }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>Edit DLQ Config</h1>

      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="topicName" style={{ fontSize: 12, fontWeight: 500 }}>Topic Name</label>
            <input
              id="topicName"
              className="input"
              value={config?.topicName ?? ''}
              readOnly
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              Topic name cannot be changed after creation.
            </span>
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

          {(downloadMode === 'SCHEDULED' || downloadMode === 'BOTH' || !!errors.cronExpression) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="cronExpression" style={{ fontSize: 12, fontWeight: 500 }}>Cron Expression</label>
              <input
                id="cronExpression"
                className={`input${errors.cronExpression ? ' error' : ''}`}
                placeholder="0 */5 * * * ?"
                {...register('cronExpression')}
              />
              {errors.cronExpression && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.cronExpression.message}</span>}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="batchSize" style={{ fontSize: 12, fontWeight: 500 }}>Batch Size</label>
            <input
              id="batchSize"
              type="number"
              className={`input${errors.batchSize ? ' error' : ''}`}
              {...register('batchSize', { valueAsNumber: true })}
            />
            {errors.batchSize && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.batchSize.message}</span>}
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
            <input
              id="retentionValue"
              type="number"
              className={`input${errors.retentionValue ? ' error' : ''}`}
              {...register('retentionValue', { valueAsNumber: true })}
            />
            {errors.retentionValue && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.retentionValue.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="defaultReplayTopic" style={{ fontSize: 12, fontWeight: 500 }}>
              Default Replay Topic <span style={{ fontWeight: 400, color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
            </label>
            <input
              id="defaultReplayTopic"
              className="input"
              placeholder="Leave blank to use x-original-topic header"
              {...register('defaultReplayTopic')}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, height: 34 }}
              onClick={() => navigate(`/clusters/${clusterId}/dlq-configs`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending}
              style={{ flex: 1, height: 34 }}
            >
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
