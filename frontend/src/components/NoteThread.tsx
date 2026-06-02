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

const AVATAR_PALETTE = [
  { bg: 'hsl(258 45% 28%)', color: 'hsl(258 80% 82%)' },
  { bg: 'hsl(211 50% 22%)', color: 'hsl(211 80% 76%)' },
  { bg: 'hsl(148 40% 18%)', color: 'hsl(148 60% 68%)' },
  { bg: 'hsl(36 50% 20%)',  color: 'hsl(36 85% 70%)'  },
  { bg: 'hsl(340 45% 22%)', color: 'hsl(340 70% 78%)' },
  { bg: 'hsl(180 40% 18%)', color: 'hsl(180 60% 68%)' },
  { bg: 'hsl(60 40% 18%)',  color: 'hsl(60 70% 72%)'  },
]

function avatarColors(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
        <p className="t-h4">Notes</p>
      </div>

      {/* Scrollable notes list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} className="scroll">
        {isLoading && <p className="t-small">Loading notes…</p>}
        {!isLoading && notes.length === 0 && (
          <p className="t-small">No notes yet.</p>
        )}
        {notes.map((note) => {
          const av = avatarColors(note.authorDisplayName)
          const initial = note.authorDisplayName.trim()[0]?.toUpperCase() ?? '?'
          return (
            <div key={note.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: av.bg, color: av.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', 'Geist', sans-serif",
                fontSize: 11, fontWeight: 700, letterSpacing: 0,
                marginTop: 1,
              }}>
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: av.color }}>{note.authorDisplayName}</span>
                  {note.ticketReference && (
                    <span className="badge" style={{
                      background: 'hsl(var(--info-muted))', color: 'hsl(var(--info))',
                      borderColor: 'hsl(var(--info) / 0.3)', fontFamily: 'monospace', letterSpacing: 0,
                    }}>
                      {note.ticketReference}
                    </span>
                  )}
                  <span className="t-small" style={{ marginLeft: 'auto', fontSize: 10 }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.55 }}>{note.content}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pinned input */}
      <form
        onSubmit={handleSubmit}
        style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}
      >
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
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Ticket ref (optional)"
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={mutation.isPending || !content.trim()}
          >
            {mutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  )
}
