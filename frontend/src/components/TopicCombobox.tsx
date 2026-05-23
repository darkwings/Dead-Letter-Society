import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface Props {
  clusterId: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function TopicCombobox({ clusterId, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isError } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => apiFetch<{ topics: string[] }>(`/api/clusters/${clusterId}/topics`),
    enabled: !!clusterId,
    staleTime: 30_000,
  })

  const topics = data?.topics ?? []
  const showSuggestions = open && inputValue.length >= 2
  const filtered = showSuggestions
    ? topics.filter((t) => t.toLowerCase().includes(inputValue.toLowerCase()))
    : []
  const typedNotInList = inputValue.length > 0 && !topics.includes(inputValue)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInput(v: string) {
    setInputValue(v)
    onChange(v)
    setOpen(true)
  }

  function handleSelect(topic: string) {
    setInputValue(topic)
    onChange(topic)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        className={`input${error ? ' error' : ''}`}
        placeholder="my-service.dlq"
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {isError && (
        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
          Could not load topics from broker. You can still type a topic name.
        </span>
      )}
      {typedNotInList && !isError && topics.length > 0 && (
        <span style={{ fontSize: 11, color: 'hsl(var(--warning, 38 92% 50%))' }}>
          Topic not found on broker. No messages will be fetched until it exists.
        </span>
      )}
      {showSuggestions && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.map((topic) => (
            <button
              key={topic}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(topic) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 12px', fontSize: 12,
                fontFamily: 'monospace',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'hsl(var(--foreground))',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--accent))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {topic}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
