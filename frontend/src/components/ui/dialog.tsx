import * as React from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div role="dialog" className="card-elevated relative z-10 shadow-lg w-full max-w-lg mx-4 p-6" style={{ borderRadius: 'var(--radius-lg)' }}>
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
