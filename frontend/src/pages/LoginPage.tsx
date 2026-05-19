import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
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
  password: z.string().min(1, 'Password required'),
})
type FormValues = z.infer<typeof schema>

interface LoginResponse {
  token: string
  user: { id: string; email: string; displayName: string; role: 'ADMIN' | 'USER' }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/setup/status'),
  })

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    if (setupStatus?.setupRequired) navigate('/setup', { replace: true })
  }, [setupStatus, navigate])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setAuth(data.token, {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        globalRole: data.user.role,
      })
      navigate('/dashboard', { replace: true })
    },
    onError: (err: unknown) => {
      const e = err as { status?: number }
      if (e.status === 403) {
        toast.error('Your account is locked. Contact your administrator.')
      } else {
        toast.error('Invalid email or password.')
      }
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="t-h2">Dead Letter Society</CardTitle>
          <CardDescription className="t-small text-muted-foreground">
            Sign in to your account.
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
                    <FormControl><Input type="email" placeholder="you@company.com" {...field} /></FormControl>
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
                {mutation.isPending ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
