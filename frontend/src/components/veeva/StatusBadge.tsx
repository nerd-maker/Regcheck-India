'use client'

import { LifecycleState, LIFECYCLE_LABEL } from '@/types/workspace'

interface StatusBadgeProps {
  state: LifecycleState
  label?: string
  size?: 'sm' | 'md'
}

const CLASS_MAP: Record<LifecycleState, string> = {
  draft:      'rc-pill rc-pill-draft',
  review:     'rc-pill rc-pill-review',
  approved:   'rc-pill rc-pill-approved',
  effective:  'rc-pill rc-pill-effective',
  rejected:   'rc-pill rc-pill-rejected',
  superseded: 'rc-pill rc-pill-superseded',
}

export default function StatusBadge({ state, label, size = 'md' }: StatusBadgeProps) {
  const txt = label ?? LIFECYCLE_LABEL[state]
  const style = size === 'sm' ? { fontSize: 10.5, padding: '1px 7px' } : undefined
  return <span className={CLASS_MAP[state]} style={style} data-testid={`status-badge-${state}`}>{txt}</span>
}
