import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useSSE, type SseEvent } from '@/hooks/useSSE'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Note {
  id: string
  messageId: string
  authorId: string
  authorDisplayName: string
  content: string
  ticketReference: string | null
  createdAt: string
}

interface NoteThreadProps {
  messageId: string
}

export default function NoteThread({ messageId }: NoteThreadProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [ticketRef, setTicketRef] = useState('')

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', messageId],
    queryFn: () => apiFetch<Note[]>(`/api/messages/${messageId}/notes`),
    enabled: !!messageId,
  })

  const handleSSE = useCallback((event: SseEvent) => {
    if (event.type === 'NOTE_ADDED' && (event.data as { messageId?: string })?.messageId === messageId) {
      queryClient.invalidateQueries({ queryKey: ['notes', messageId] })
    }
  }, [messageId, queryClient])

  useSSE(handleSSE)

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<Note>(`/api/messages/${messageId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), ticketReference: ticketRef.trim() || null }),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(['notes', messageId], (old = []) => [...old, note])
      setContent('')
      setTicketRef('')
    },
    onError: (e: unknown) => {
      const err = e as { body?: { message?: string }; message?: string }
      toast.error(err.body?.message ?? err.message ?? 'Failed to add note')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    mutation.mutate()
  }

  return (
    <div className="space-y-4">
      {isLoading && <p className="t-small text-muted-foreground">Loading notes…</p>}

      {!isLoading && notes.length === 0 && (
        <p className="t-small text-muted-foreground">No notes yet.</p>
      )}

      {notes.map((note) => (
        <div key={note.id} className="rounded-md border p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{note.authorDisplayName}</span>
            <span className="t-small text-muted-foreground">
              {new Date(note.createdAt).toLocaleString()}
            </span>
            {note.ticketReference && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-mono text-blue-800">
                {note.ticketReference}
              </span>
            )}
          </div>
          <p className="text-sm">{note.content}</p>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          placeholder="Add a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none resize-none',
            'placeholder:text-muted-foreground',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        />
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ticket ref (optional)"
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
            className={cn(
              'h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
              'placeholder:text-muted-foreground',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
          />
          <Button type="submit" disabled={mutation.isPending || !content.trim()}>
            {mutation.isPending ? 'Adding…' : 'Add Note'}
          </Button>
        </div>
      </form>
    </div>
  )
}
