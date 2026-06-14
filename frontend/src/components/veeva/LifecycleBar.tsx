'use client'

interface LifecycleBarProps {
  current: string
}

const LIFECYCLE_STAGES = [
  { id: 'draft',        label: 'Draft' },
  { id: 'in_review',    label: 'In Review' },
  { id: 'submitted',    label: 'Submitted' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'approved',     label: 'Approved' },
]

const STATE_MAPPING: Record<string, number> = {
  'draft': 0,
  'review': 1,
  'in_review': 1,
  'submitted': 2,
  'effective': 2,
  'under_review': 3,
  'approved': 4,
  'rejected': 3,
  'superseded': 4,
}

export default function LifecycleBar({ current }: LifecycleBarProps) {
  const currentIdx = STATE_MAPPING[current] ?? 0

  return (
    <div className="rc-lifecycle" data-testid="lifecycle-bar">
      {LIFECYCLE_STAGES.map((step, i) => {
        const cls = i < currentIdx ? 'is-done' : i === currentIdx ? 'is-current' : ''
        return (
          <div key={step.id} className={`rc-lifecycle-step ${cls}`}>
            <span className="rc-lifecycle-num">
              {i < currentIdx ? <i className="ti ti-check" style={{ fontSize: 11 }}/> : i + 1}
            </span>
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}
