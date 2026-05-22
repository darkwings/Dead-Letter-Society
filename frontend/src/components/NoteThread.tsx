import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useSSE, type SseEvent } from '@/hooks/useSSE'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isLoading && <p className="t-small">Loading notes…</p>}

      {!isLoading && notes.length === 0 && (
        <p className="t-small">No notes yet.</p>
      )}

      {notes.map((note) => (
        <div key={note.id} className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{note.authorDisplayName}</span>
            <span className="t-small">{new Date(note.createdAt).toLocaleString()}</span>
            {note.ticketReference && (
              <span className="badge" style={{
                background: 'hsl(var(--info-muted))', color: 'hsl(var(--info))',
                borderColor: 'hsl(var(--info) / 0.3)', fontFamily: 'monospace', letterSpacing: 0,
              }}>
                {note.ticketReference}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.5 }}>{note.content}</p>
        </div>
      ))}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          className="textarea"
          placeholder="Add a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{ resize: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            className="input"
            style={{ width: 192 }}
            placeholder="Ticket ref (optional)"
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={mutation.isPending || !content.trim()}
          >
            {mutation.isPending ? 'Adding…' : 'Add Note'}
          </button>
        </div>
      </form>
    </div>
  )
}
