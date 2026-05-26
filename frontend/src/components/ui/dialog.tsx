import * as React from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        className="card-elevated"
        style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 560, margin: '0 16px',
          padding: 24, borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="t-h2" style={{ marginBottom: 16 }}>{children}</h2>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>{children}</div>
}
