import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface ReplayWizardProps {
  messageId: string
  resolvedTopic: string | null
  hasDecodedPayload: boolean
  decodedPayload: unknown
  onClose: () => void
}

type Step = 'review' | 'edit' | 'confirm'

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

      {step === 'review' && (
        <div>
          <p className="t-small text-muted-foreground mb-4">
            Step 1 of 3 — Review target topic
          </p>
          <div className="mb-4">
            <Label htmlFor="topic-override">Target Topic</Label>
            <Input
              id="topic-override"
              data-testid="topic-override"
              className="mt-1 font-mono"
              placeholder={resolvedTopic ?? 'No topic resolved'}
              value={topicOverride}
              onChange={(e) => setTopicOverride(e.target.value)}
            />
            {resolvedTopic && !topicOverride && (
              <p className="text-xs text-muted-foreground mt-1">
                Will use: <span className="font-mono">{resolvedTopic}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {hasDecodedPayload && (
              <Button
                variant="outline"
                onClick={() => setStep('edit')}
                disabled={!effectiveTopic}
              >
                Edit Payload
              </Button>
            )}
            <Button
              onClick={() => setStep('confirm')}
              disabled={!effectiveTopic}
            >
              Next
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 'edit' && (
        <div>
          <p className="t-small text-muted-foreground mb-4">
            Step 2 of 3 — Edit payload (optional)
          </p>
          <div className="mb-4">
            <Label htmlFor="payload-editor">Payload JSON</Label>
            <textarea
              id="payload-editor"
              data-testid="payload-editor"
              className="mt-1 w-full h-48 font-mono text-sm p-2 border rounded bg-muted resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={payloadText}
              onChange={(e) => {
                setPayloadText(e.target.value)
                setPayloadEdited(true)
                setValidationError(null)
              }}
            />
            {validationError && (
              <p className="text-xs text-destructive mt-1" data-testid="validation-error">
                {validationError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('review')}>Back</Button>
            <Button
              onClick={async () => {
                if (!payloadEdited || !payloadText) { setStep('confirm'); return }
                const valid = await validateMutation(payloadText)
                if (valid) setStep('confirm')
              }}
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : 'Next'}
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <p className="t-small text-muted-foreground mb-4">
            Step 3 of 3 — Confirm replay
          </p>
          <div className="p-4 rounded border bg-card mb-4 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Target Topic</p>
              <p className="font-mono text-sm">{effectiveTopic}</p>
            </div>
            {payloadEdited && (
              <div>
                <p className="text-xs text-muted-foreground">Payload</p>
                <p className="text-sm">Edited by user</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(hasDecodedPayload ? 'edit' : 'review')}>
              Back
            </Button>
            <Button
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending || !!validationError}
            >
              {replayMutation.isPending ? 'Replaying...' : 'Confirm Replay'}
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
