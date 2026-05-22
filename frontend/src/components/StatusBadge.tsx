export const STATUS_LABEL: Record<string, string> = {
  NEW: 'NEW',
  UNDER_REVIEW: 'UNDER REVIEW',
  REPLAYED: 'REPLAYED',
  DISCARDED: 'DISCARDED',
  REPLAY_FAILED: 'REPLAY FAILED',
}

const STATUS_CLASS: Record<string, string> = {
  NEW: 's-new',
  UNDER_REVIEW: 's-under-review',
  REPLAYED: 's-replayed',
  DISCARDED: 's-discarded',
  REPLAY_FAILED: 's-replay-failed',
}

export function StatusBadge({ status, testId }: { status: string; testId?: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] ?? ''}`} data-testid={testId}>
      <span className="badge-dot" />
      {STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
    </span>
  )
}
