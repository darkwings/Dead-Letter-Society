import { useNavigate } from 'react-router-dom'
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { securityProtocol: 'PLAINTEXT' },
  })
  const protocol = form.watch('securityProtocol')

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch('/api/clusters', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Cluster created')
      navigate('/clusters')
    },
    onError: (e: unknown) => {
      const err = e as { body?: { message?: string }; message?: string }
      toast.error(err.body?.message ?? err.message ?? 'Failed to create cluster')
    },
  })

  return (
    <RouteGuard>
      <div className="p-8 max-w-xl">
        <h1 className="t-h1 mb-6">Add Kafka Cluster</h1>
        <Card>
          <CardHeader>
            <CardTitle>Cluster Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bootstrapServers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bootstrap Servers</FormLabel>
                      <FormControl>
                        <Input placeholder="host:9092" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="securityProtocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security Protocol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROTOCOLS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {SASL_PROTOCOLS.includes(protocol as Protocol) && (
                  <>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                {protocol === 'SSL' && (
                  <FormField
                    control={form.control}
                    name="keystorePem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Keystore PEM</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="srUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schema Registry URL (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="http://localhost:8081" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={mutation.isPending} className="w-full">
                  {mutation.isPending ? 'Saving...' : 'Save Cluster'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  )
}
