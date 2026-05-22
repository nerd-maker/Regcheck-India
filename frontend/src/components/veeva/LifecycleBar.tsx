'use client'

import { SUBMISSION_LIFECYCLE, LifecycleState } from '@/lib/mockData'

interface LifecycleBarProps {
  current: LifecycleState
}

const STATE_ORDER: LifecycleState[] = ['draft', 'review', 'approved', 'effective']

export default function LifecycleBar({ current }: LifecycleBarProps) {
  // For rejected/superseded — show "stuck" at review
  const effective = current === 'rejected' ? 'review' : (current === 'superseded' ? 'effective' : current)
  const currentIdx = STATE_ORDER.indexOf(effective)

  return (
    <div className="rc-lifecycle" data-testid="lifecycle-bar">
      {SUBMISSION_LIFECYCLE.map((step, i) => {
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
