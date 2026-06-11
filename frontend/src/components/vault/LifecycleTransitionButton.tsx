'use client'

import { useState } from 'react'
import { transitionVaultDocumentState } from '@/services/api'
import type { LifecycleState } from '@/types/vault'

interface Props {
  documentId: string
  currentState: LifecycleState
  ownerName: string
  ownerInitials: string
  onTransitionSuccess: (newState: LifecycleState) => void
}

// Valid transitions — mirrors backend VALID_TRANSITIONS
const TRANSITION_CONFIG: Record<LifecycleState, {
  primary?: { label: string; nextState: LifecycleState; icon: string }
  secondary?: { label: string; nextState: LifecycleState }
}> = {
  draft: {
    primary: { label: 'Send for Review', nextState: 'in_review', icon: 'ti-send' },
    secondary: { label: 'Supersede', nextState: 'superseded' },
  },
  in_review: {
    primary: { label: 'Approve', nextState: 'approved', icon: 'ti-check' },
    secondary: { label: 'Return to Draft', nextState: 'draft' },
  },
  approved: {
    primary: { label: 'Mark Effective', nextState: 'effective', icon: 'ti-circle-check' },
    secondary: { label: 'Supersede', nextState: 'superseded' },
  },
  effective: {
    secondary: { label: 'Supersede', nextState: 'superseded' },
  },
  superseded: {},
  rejected: {
    primary: { label: 'Return to Draft', nextState: 'draft', icon: 'ti-arrow-back' },
    secondary: { label: 'Supersede', nextState: 'superseded' },
  },
}

const PRIMARY_COLORS: Record<string, { bg: string; hover: string }> = {
  in_review:  { bg: '#1A56DB', hover: '#1E429F' },
  approved:   { bg: '#057A55', hover: '#046C4E' },
  effective:  { bg: '#047857', hover: '#065F46' },
  draft:      { bg: '#6B7280', hover: '#4B5563' },
}

export function LifecycleTransitionButton({
  documentId,
  currentState,
  ownerName,
  ownerInitials,
  onTransitionSuccess,
}: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<LifecycleState | null>(null)

  const config = TRANSITION_CONFIG[currentState]
  if (!config || (!config.primary && !config.secondary)) return null

  const handleTransition = async (nextState: LifecycleState) => {
    setIsLoading(true)
    setError(null)
    setShowConfirm(null)
    try {
      await transitionVaultDocumentState(
        documentId,
        nextState,
        ownerName,
        ownerInitials,
      )
      onTransitionSuccess(nextState)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        setError(axiosErr.response?.data?.detail ?? 'Transition failed')
      } else {
        setError('Transition failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const primaryColors = config.primary
    ? PRIMARY_COLORS[config.primary.nextState] ?? { bg: '#1A56DB', hover: '#1E429F' }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0' }}>
      {config.primary && primaryColors && (
        <button
          onClick={() => setShowConfirm(config.primary!.nextState)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '7px 12px',
            borderRadius: 'var(--rc-radius-md, 6px)',
            border: 'none',
            background: primaryColors.bg,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = primaryColors.hover }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = primaryColors.bg }}
          data-testid="lifecycle-primary-btn"
        >
          <i className={`ti ${config.primary.icon}`} style={{ fontSize: 14 }}/>
          {isLoading ? 'Processing…' : config.primary.label}
        </button>
      )}

      {config.secondary && (
        <button
          onClick={() => setShowConfirm(config.secondary!.nextState)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '6px 12px',
            borderRadius: 'var(--rc-radius-md, 6px)',
            border: '1px solid var(--rc-border)',
            background: 'transparent',
            color: 'var(--rc-text-secondary)',
            fontSize: 11.5,
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'var(--rc-surface-secondary)' }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent' }}
          data-testid="lifecycle-secondary-btn"
        >
          {config.secondary.label}
        </button>
      )}

      {error && (
        <div style={{
          fontSize: 11,
          color: 'var(--rc-rejected, #DC2626)',
          background: 'var(--rc-rejected-bg, #FEF2F2)',
          padding: '6px 10px',
          borderRadius: 'var(--rc-radius-md, 6px)',
          lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}

      {showConfirm && (
        <div style={{
          border: '1px solid #FCD34D',
          background: '#FFFBEB',
          borderRadius: 'var(--rc-radius-md, 6px)',
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.4, marginBottom: 8 }}>
            Move document to <strong>{showConfirm.replace('_', ' ')}</strong>?
            {showConfirm === 'in_review' && (
              <span style={{ display: 'block', marginTop: 3, color: '#B45309' }}>
                <i className="ti ti-sparkles" style={{ fontSize: 11, marginRight: 3 }}/>
                Compliance agents will run automatically.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleTransition(showConfirm)}
              disabled={isLoading}
              style={{
                padding: '4px 12px',
                background: '#D97706',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              data-testid="lifecycle-confirm-btn"
            >
              {isLoading ? 'Processing…' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              style={{
                padding: '4px 12px',
                color: '#6B7280',
                fontSize: 11,
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
              }}
              data-testid="lifecycle-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
