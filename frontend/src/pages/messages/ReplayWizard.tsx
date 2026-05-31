import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface ReplayWizardProps {
  messageId: string
  resolvedTopic: string | null
  hasDecodedPayload: boolean
  decodedPayload: unknown
  onClose: () => void
}

type Step = 'review' | 'edit' | 'confirm'

const STEPS: { key: Step; label: string }[] = [
  { key: 'review', label: 'Select Topic' },
  { key: 'edit', label: 'Edit Payload' },
  { key: 'confirm', label: 'Confirm' },
]

interface ReplayRequest {
  targetTopicOverride?: string
  editedPayload?: unknown
}

interface ReplayResult {
  success: boolean
  targetTopic: string | null
  failureReason: string | null
}

interface ValidateResult {
  valid: boolean
  error: string | null
}

export default function ReplayWizard({
  messageId,
  resolvedTopic,
  hasDecodedPayload,
  decodedPayload,
  onClose,
}: ReplayWizardProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('review')
  const [topicOverride, setTopicOverride] = useState('')
  const [payloadText, setPayloadText] = useState(
    decodedPayload ? JSON.stringify(decodedPayload, null, 2) : ''
  )
  const [payloadEdited, setPayloadEdited] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const effectiveTopic = topicOverride.trim() || resolvedTopic || ''

  const validateMutation = useCallback(async (text: string) => {
    setIsValidating(true)
    setValidationError(null)
    try {
      const parsed = JSON.parse(text)
      const result = await apiFetch<ValidateResult>(
        `/api/messages/${messageId}/validate-payload`,
        { method: 'POST', body: JSON.stringify({ payload: parsed }) }
      )
      if (!result.valid) setValidationError(result.error ?? 'Invalid payload')
      return result.valid
    } catch {
      setValidationError('Invalid JSON')
      return false
    } finally {
      setIsValidating(false)
    }
  }, [messageId])

  const replayMutation = useMutation({
    mutationFn: () => {
      const body: ReplayRequest = {}
      if (topicOverride.trim()) body.targetTopicOverride = topicOverride.trim()
      if (payloadEdited && payloadText) {
        try {
          body.editedPayload = JSON.parse(payloadText)
        } catch {
          throw new Error('Invalid JSON in payload editor')
        }
      }
      return apiFetch<ReplayResult>(`/api/messages/${messageId}/replay`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['message', messageId] })
        toast.success('Replay successful')
        onClose()
      } else {
        toast.error(result.failureReason ?? 'Replay failed')
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Replay Message</DialogTitle>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {STEPS.map((s, i) => {
          const active = s.key === step
          const done = STEPS.findIndex(x => x.key === step) > i
          return (
            <div
              key={s.key}
              style={{
                flex: 1, textAlign: 'center', fontSize: 11, paddingBottom: 6,
                fontWeight: active ? 600 : 400,
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                borderBottom: `2px solid ${active ? 'hsl(var(--primary))' : done ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`,
              }}
            >
              {i + 1}. {s.label}
            </div>
          )
        })}
      </div>

      {step === 'review' && (
        <div>
          <p className="t-small" style={{ marginBottom: 16 }}>
            Step 1 of 3 — Review target topic
          </p>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="topic-override" style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Target Topic
            </label>
            <input
              id="topic-override"
              data-testid="topic-override"
              className="input"
              style={{ fontFamily: 'monospace' }}
              placeholder={resolvedTopic ?? 'No topic resolved'}
              value={topicOverride}
              onChange={(e) => setTopicOverride(e.target.value)}
            />
            {resolvedTopic && !topicOverride && (
              <p className="t-small" style={{ marginTop: 4 }}>
                Will use: <span style={{ fontFamily: 'monospace' }}>{resolvedTopic}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(hasDecodedPayload ? 'edit' : 'confirm')}
              disabled={!effectiveTopic}
            >
              Next
            </button>
          </DialogFooter>
        </div>
      )}

      {step === 'edit' && (
        <div>
          <p className="t-small" style={{ marginBottom: 16 }}>
            Step 2 of 3 — Edit payload (optional)
          </p>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="payload-editor" style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Payload JSON
            </label>
            <textarea
              id="payload-editor"
              data-testid="payload-editor"
              className="textarea t-code"
              style={{ height: 192, resize: 'none' }}
              value={payloadText}
              onChange={(e) => {
                setPayloadText(e.target.value)
                setPayloadEdited(true)
                setValidationError(null)
              }}
            />
            {validationError && (
              <p data-testid="validation-error" style={{ fontSize: 11, color: 'hsl(var(--destructive))', marginTop: 4 }}>
                {validationError}
              </p>
            )}
          </div>
          <DialogFooter>
            <button className="btn btn-secondary" onClick={() => setStep('review')}>Back</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!payloadEdited || !payloadText) { setStep('confirm'); return }
                const valid = await validateMutation(payloadText)
                if (valid) setStep('confirm')
              }}
              disabled={isValidating}
            >
              {isValidating ? 'Validating…' : 'Next'}
            </button>
          </DialogFooter>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <p className="t-small" style={{ marginBottom: 16 }}>
            Step 3 of 3 — Confirm replay
          </p>
          <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <p className="t-small" style={{ marginBottom: 2 }}>Target Topic</p>
              <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{effectiveTopic}</p>
            </div>
            {payloadEdited && (
              <div>
                <p className="t-small" style={{ marginBottom: 2 }}>Payload</p>
                <p style={{ fontSize: 12 }}>Edited by user</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <button className="btn btn-secondary" onClick={() => setStep(hasDecodedPayload ? 'edit' : 'review')}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending || !!validationError}
            >
              {replayMutation.isPending ? 'Replaying…' : 'Confirm Replay'}
            </button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
