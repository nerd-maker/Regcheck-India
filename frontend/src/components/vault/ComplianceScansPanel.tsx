'use client'

import { useEffect, useState } from 'react'
import { fetchVaultDocumentScans } from '@/services/api'
import type { ComplianceScanSchema } from '@/types/vault'

interface Props {
  documentId: string
  /** Increment to force a re-fetch (e.g. after a state transition triggers new scans) */
  refreshTrigger: number
}

const AGENT_LABELS: Record<string, string> = {
  schedule_y:     'Schedule Y Check',
  ich_e6r3:       'ICH E6(R3) GCP',
  completeness:   'Completeness Check',
  cross_doc:      'Cross-Doc Consistency',
  pii_anonymiser: 'PII Anonymiser',
  sae_classifier: 'SAE Case Classifier',
}

const AGENT_ICONS: Record<string, string> = {
  schedule_y:     'ti-scale',
  ich_e6r3:       'ti-certificate-2',
  completeness:   'ti-checklist',
  cross_doc:      'ti-files',
  pii_anonymiser: 'ti-shield-check',
  sae_classifier: 'ti-alert-triangle',
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'var(--rc-surface-tertiary, #F3F4F6)', color: 'var(--rc-text-muted, #6B7280)',     label: 'Pending' },
  running:   { bg: '#DBEAFE',                              color: '#1E40AF',                           label: 'Running…' },
  completed: { bg: 'var(--rc-approved-bg, #DEF7EC)',       color: 'var(--rc-approved, #057A55)',        label: 'Completed' },
  failed:    { bg: 'var(--rc-rejected-bg, #FDE8E8)',       color: 'var(--rc-rejected, #E02424)',        label: 'Failed' },
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 80
    ? 'var(--rc-approved, #057A55)'
    : score >= 60
      ? 'var(--rc-review, #D97706)'
      : 'var(--rc-rejected, #E02424)'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, color: 'var(--rc-text-muted)' }}>Compliance score</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}%</span>
      </div>
      <div className="rc-scorebar">
        <div
          className="rc-scorebar-fill"
          style={{ width: `${Math.min(score, 100)}%`, background: color, transition: 'width 0.4s ease' }}
        />
      </div>
    </div>
  )
}

function FindingsList({ findings }: { findings: unknown[] }) {
  if (!findings || findings.length === 0) return null
  const items = findings.slice(0, 4)
  const remaining = findings.length - items.length

  return (
    <div style={{ marginTop: 6 }}>
      {items.map((item, i) => {
        const text = typeof item === 'string' ? item : JSON.stringify(item)
        return (
          <div key={i} style={{
            display: 'flex',
            gap: 5,
            fontSize: 11,
            color: 'var(--rc-text-secondary)',
            lineHeight: 1.4,
            marginBottom: 3,
          }}>
            <span style={{ color: 'var(--rc-review, #D97706)', flexShrink: 0, marginTop: 1 }}>•</span>
            <span style={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>{text}</span>
          </div>
        )
      })}
      {remaining > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', marginTop: 2, paddingLeft: 12 }}>
          +{remaining} more findings
        </div>
      )}
    </div>
  )
}

export function ComplianceScansPanel({ documentId, refreshTrigger }: Props) {
  const [scans, setScans] = useState<ComplianceScanSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchVaultDocumentScans(documentId)
        if (!cancelled) setScans(data.scans)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load scans')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    // Auto-refresh every 5s while any scan is running/pending
    intervalId = setInterval(async () => {
      try {
        const data = await fetchVaultDocumentScans(documentId)
        if (!cancelled) {
          setScans(data.scans)
          const anyRunning = data.scans.some(
            (s: ComplianceScanSchema) => s.status === 'running' || s.status === 'pending'
          )
          if (!anyRunning && intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      } catch {
        // Silent — don't disrupt polling on transient errors
      }
    }, 5000)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [documentId, refreshTrigger])

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        {[1, 2].map(i => (
          <div key={i} style={{
            height: 72,
            background: 'var(--rc-surface-secondary, #F9FAFB)',
            borderRadius: 'var(--rc-radius-md, 6px)',
            marginBottom: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}/>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--rc-rejected, #E02424)' }}>{error}</div>
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <i className="ti ti-shield-search" style={{ fontSize: 28, color: 'var(--rc-text-muted)', display: 'block', marginBottom: 8 }}/>
        <div style={{ fontSize: 12, color: 'var(--rc-text-muted)' }}>No compliance scans yet.</div>
        <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 4, opacity: 0.7 }}>
          Move this document to <strong>In Review</strong> to trigger automatic compliance checks.
        </div>
      </div>
    )
  }

  // Deduplicate: show only the most recent scan per scan_type
  const latestByType: Record<string, ComplianceScanSchema> = {}
  for (const scan of scans) {
    if (!latestByType[scan.scan_type]) {
      latestByType[scan.scan_type] = scan
    }
  }

  return (
    <div data-testid="compliance-scans-panel">
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--rc-surface-secondary)',
        fontSize: 11.5,
        color: 'var(--rc-text-secondary)',
        borderBottom: '1px solid var(--rc-divider)',
      }}>
        <i className="ti ti-shield-check" style={{ fontSize: 13, color: 'var(--rc-primary)', marginRight: 6 }}/>
        Auto-scan results from compliance agents.
      </div>

      {/* Scan cards */}
      <div style={{ padding: '8px 12px' }}>
        {Object.values(latestByType).map(scan => {
          const statusStyle = STATUS_STYLES[scan.status] ?? STATUS_STYLES.pending
          const icon = AGENT_ICONS[scan.scan_type] ?? 'ti-shield'
          const isRunning = scan.status === 'running'

          return (
            <div
              key={scan.id}
              style={{
                border: '1px solid var(--rc-divider)',
                borderRadius: 'var(--rc-radius-md, 6px)',
                padding: '10px 12px',
                marginBottom: 8,
                background: 'var(--rc-surface, #fff)',
              }}
              data-testid={`scan-card-${scan.scan_type}`}
            >
              {/* Agent name + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 14, color: 'var(--rc-primary)' }}/>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rc-text-primary)' }}>
                    {AGENT_LABELS[scan.scan_type] ?? scan.scan_type}
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  animation: isRunning ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}>
                  {statusStyle.label}
                </span>
              </div>

              {/* Score bar */}
              <ScoreBar score={scan.score} />

              {/* Findings summary */}
              <FindingsList findings={scan.findings as unknown[]} />

              {/* Timestamp */}
              {scan.created_at && (
                <div style={{ fontSize: 10, color: 'var(--rc-text-muted)', marginTop: 6 }}>
                  {new Date(scan.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
