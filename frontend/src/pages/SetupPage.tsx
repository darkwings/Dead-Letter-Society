import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export default function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/setup/status'),
  })

  useEffect(() => {
    if (setupStatus && !setupStatus.setupRequired) {
      navigate('/login', { replace: true })
    }
  }, [setupStatus, navigate])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', displayName: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<void>('/api/setup', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Administrator account created. Please sign in.')
      queryClient.removeQueries({ queryKey: ['setup-status'] })
      navigate('/login', { replace: true })
    },
    onError: (err: unknown) => {
      const e = err as { status?: number }
      if (e.status === 409) {
        toast.error('Setup already complete.')
        queryClient.removeQueries({ queryKey: ['setup-status'] })
        navigate('/login', { replace: true })
      } else {
        toast.error('Setup failed. Please try again.')
      }
    },
  })

  if (isLoading) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="t-h2">Create Administrator Account</CardTitle>
          <CardDescription className="t-small text-muted-foreground">
            First-time setup — create the initial admin user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="admin@company.com" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="Admin" {...field} /></FormControl>
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
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
