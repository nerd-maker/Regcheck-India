'use client'

import { useEffect, useState } from 'react'
import { getScoreTrend } from '@/services/history'

interface TrendPoint {
  date: string
  score: number
  filename?: string
}

interface Props {
  agentId: string
  agentName: string
  submissionId?: string
}

export function ComplianceTrendChart({
  agentId, agentName, submissionId
}: Props) {
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getScoreTrend(agentId, submissionId)
      .then(setTrend)
      .finally(() => setLoading(false))
  }, [agentId, submissionId])

  if (loading) return (
    <div style={{
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      color: 'var(--rc-text-muted)',
    }}>
      Loading trend…
    </div>
  )

  if (trend.length < 2) return (
    <div style={{
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      color: 'var(--rc-text-muted)',
      textAlign: 'center',
      padding: '0 16px',
    }}>
      Run this agent at least twice to see the compliance score trend.
    </div>
  )

  const max = 100
  const min = Math.max(0, Math.min(...trend.map(p => p.score)) - 10)
  const range = max - min
  const W = 280
  const H = 80
  const pad = 20

  const points = trend.map((p, i) => ({
    x: pad + (i / (trend.length - 1)) * (W - pad * 2),
    y: H - pad - ((p.score - min) / range) * (H - pad * 2),
    ...p,
  }))

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const latest = trend[trend.length - 1]
  const earliest = trend[0]
  const delta = latest.score - earliest.score
  const deltaColor = delta >= 0 ? 'var(--rc-approved)' : 'var(--rc-rejected)'
  const deltaLabel = `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(0)}pts`

  return (
    <div style={{
      border: '1px solid var(--rc-divider)',
      borderRadius: 8,
      background: 'var(--rc-surface)',
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--rc-text-muted)',
        }}>
          {agentName} — Score Trend
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: deltaColor,
        }}>
          {deltaLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 80, display: 'block' }}
      >
        {/* Grid lines */}
        {[25, 50, 75, 100].map(v => {
          const y = H - pad - ((v - min) / range) * (H - pad * 2)
          if (y < 0 || y > H) return null
          return (
            <line
              key={v}
              x1={pad} y1={y} x2={W - pad} y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          )
        })}

        {/* Trend line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--rc-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points with tooltips */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x} cy={p.y} r={3}
              fill="var(--rc-primary)"
            />
            <title>
              {p.date}: {p.score}%{p.filename ? ` (${p.filename})` : ''}
            </title>
          </g>
        ))}

        {/* Score labels at first and last */}
        <text
          x={points[0].x} y={points[0].y - 6}
          textAnchor="middle"
          fontSize={9}
          fill="currentColor"
          opacity={0.6}
        >
          {earliest.score}%
        </text>
        <text
          x={points[points.length - 1].x}
          y={points[points.length - 1].y - 6}
          textAnchor="middle"
          fontSize={9}
          fill="var(--rc-primary)"
          fontWeight="700"
        >
          {latest.score}%
        </text>
      </svg>

      {/* Date labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 4,
      }}>
        <span style={{ fontSize: 10, color: 'var(--rc-text-muted)' }}>
          {earliest.date}
        </span>
        <span style={{ fontSize: 10, color: 'var(--rc-text-muted)' }}>
          {latest.date}
        </span>
      </div>
    </div>
  )
}
