import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import RouteGuard from '@/components/RouteGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  topicName: z.string().min(1, 'Topic name required'),
  displayName: z.string().min(1, 'Display name required'),
  downloadMode: z.enum(['SCHEDULED', 'ON_DEMAND', 'BOTH']),
  cronExpression: z.string().optional(),
  batchSize: z.coerce.number().min(1).max(10000),
  retentionType: z.enum(['MAX_AGE_DAYS', 'MAX_COUNT']),
  retentionValue: z.coerce.number().min(1),
})
type FormValues = z.infer<typeof schema>

export default function CreateDlqConfigPage() {
  const { clusterId } = useParams<{ clusterId: string }>()
  const navigate = useNavigate()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      downloadMode: 'ON_DEMAND',
      batchSize: 100,
      retentionType: 'MAX_AGE_DAYS',
      retentionValue: 30,
    },
  })
  const downloadMode = form.watch('downloadMode')
  const retentionType = form.watch('retentionType')

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch(`/api/clusters/${clusterId}/dlq-configs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('DLQ config created')
      navigate(`/clusters/${clusterId}/dlq-configs`)
    },
    onError: (e: unknown) => {
      const err = e as { body?: { message?: string }; message?: string }
      toast.error(err.body?.message ?? err.message ?? 'Failed to create DLQ config')
    },
  })

  return (
    <RouteGuard>
      <div className="p-8 max-w-xl">
        <h1 className="t-h1 mb-6">Add DLQ Config</h1>
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="topicName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic Name</FormLabel>
                      <FormControl>
                        <Input placeholder="my-service.dlq" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="downloadMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Download Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ON_DEMAND">On Demand</SelectItem>
                          <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(downloadMode === 'SCHEDULED' || downloadMode === 'BOTH') && (
                  <FormField
                    control={form.control}
                    name="cronExpression"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron Expression</FormLabel>
                        <FormControl>
                          <Input placeholder="0 */5 * * * ?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="batchSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Size</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retentionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retention Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MAX_AGE_DAYS">Max Age (days)</SelectItem>
                          <SelectItem value="MAX_COUNT">Max Count</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retentionValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {retentionType === 'MAX_AGE_DAYS' ? 'Max Days' : 'Max Messages'}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={mutation.isPending} className="w-full">
                  {mutation.isPending ? 'Saving...' : 'Save DLQ Config'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  )
}
