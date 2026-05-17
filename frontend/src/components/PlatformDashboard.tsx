'use client'

interface Props {
  activeView: string
  onNavigate: (id: string) => void
}

const MOCK_SUBMISSIONS = [
  {
    id: 'sub-001',
    name: 'ZP-101 Phase II — Type 2 Diabetes',
    type: 'IND Application',
    ref: 'CDSCO/IND/2024/CT-0892',
    docs: 6,
    status: 'review',
    statusLabel: 'Needs revision',
    score: 45,
    framework: 'Schedule Y',
    icon: 'ti-flask',
    iconColor: '#0d9488',
    iconBg: '#e1f5ee',
  },
  {
    id: 'sub-002',
    name: 'BX-400 Phase III — Complicated UTI',
    type: 'SAE Review',
    ref: 'CASE-2025-0089',
    docs: 2,
    status: 'critical',
    statusLabel: '2 critical SAEs',
    score: 62,
    framework: 'ICH E2A',
    icon: 'ti-activity',
    iconColor: '#185fa5',
    iconBg: '#e6f1fb',
  },
  {
    id: 'sub-003',
    name: 'BX-500 Phase I FIH — JAK Inhibitor',
    type: 'Protocol Review',
    ref: 'Pre-IND · 4 documents',
    docs: 4,
    status: 'ready',
    statusLabel: 'Ready for CDSCO',
    score: 87,
    framework: 'Schedule Y',
    icon: 'ti-pill',
    iconColor: '#854f0b',
    iconBg: '#faeeda',
  },
]

const RECENT_ACTIVITY = [
  {
    type: 'critical',
    text: 'Cross-doc check flagged dose mismatch — Protocol v2 says 400 mg but ICF shows 200 mg',
    sub: 'ZP-101',
    time: '12 minutes ago',
  },
  {
    type: 'success',
    text: 'Schedule Y check completed — 3 critical gaps resolved, 2 major gaps remaining',
    sub: 'BX-500',
    time: '1 hour ago',
  },
  {
    type: 'warning',
    text: 'SAE CASE-2025-0089 classified as anaphylaxis — expedited reporting required within 7 days',
    sub: 'BX-400',
    time: '2 hours ago',
  },
  {
    type: 'success',
    text: 'PII anonymisation complete — 8 entities removed from Protocol v2 draft',
    sub: 'ZP-101',
    time: '3 hours ago',
  },
]

const COMPLIANCE_DATA = [
  { name: 'Schedule Y',           score: 45, color: '#d97706' },
  { name: 'ICH E6(R3) GCP',       score: 78, color: '#0d9488' },
  { name: 'NDCTR 2019',            score: 62, color: '#d97706' },
  { name: 'Completeness',         score: 87, color: '#0d9488' },
  { name: 'Cross-doc consistency', score: 33, color: '#dc2626' },
  { name: 'PII compliance',       score: 100, color: '#0d9488' },
]

const PIPELINE_STEPS = [
  { label: 'PII anonymised',     status: 'done'    },
  { label: 'Completeness 78%',   status: 'done'    },
  { label: 'Schedule Y 45%',     status: 'warn'    },
  { label: 'Cross-doc check',    status: 'running' },
  { label: 'Export report',      status: 'pending' },
]

function stepStyle(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    done:    { bg: '#e1f5ee', color: '#0f6e56' },
    warn:    { bg: '#faeeda', color: '#854f0b' },
    running: { bg: '#e6f1fb', color: '#185fa5' },
    pending: { bg: 'var(--rc-surface-secondary)', color: 'var(--rc-text-muted)' },
  }
  return map[status] || map.pending
}

function stepIcon(status: string) {
  const map: Record<string, string> = {
    done:    'ti-check',
    warn:    'ti-alert-triangle',
    running: 'ti-loader',
    pending: 'ti-circle',
  }
  return map[status] || 'ti-circle'
}

export default function PlatformDashboard({ onNavigate }: Props) {
  const demoName =
    typeof window !== 'undefined'
      ? localStorage.getItem('demo_name') || 'there'
      : 'there'

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--rc-text-primary)' }}>
          {greeting}, {demoName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', marginTop: 3 }}>
          RegCheck-India workspace · {MOCK_SUBMISSIONS.length} active submissions
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Active submissions', value: '4',   color: 'var(--rc-text-primary)' },
          { label: 'Compliance checks run', value: '218', color: '#0d9488'            },
          { label: 'Critical gaps open', value: '7',   color: '#dc2626'               },
          { label: 'Ready for CDSCO',  value: '1',   color: '#d97706'                },
        ].map((m, i) => (
          <div key={i} className="rc-card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* ── Active submissions ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--rc-text-secondary)' }}>
          Active submissions
        </div>
        <button
          onClick={() => onNavigate('submissions')}
          style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          View all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {MOCK_SUBMISSIONS.map(sub => (
          <div
            key={sub.id}
            className="rc-card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px' }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: sub.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className={`ti ${sub.icon}`} aria-hidden="true" style={{ fontSize: 16, color: sub.iconColor }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rc-text-primary)' }}>
                {sub.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 2 }}>
                {sub.type} · {sub.ref} · {sub.docs} documents
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span className={`status-${sub.status}`}>{sub.statusLabel}</span>
              <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>
                {sub.framework} {sub.score}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pipeline + Compliance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Pipeline */}
        <div className="rc-card">
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 12 }}>
            ZP-101 compliance pipeline
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PIPELINE_STEPS.map((step, i) => {
              const s = stepStyle(step.status)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6, fontSize: 11,
                  background: s.bg, color: s.color,
                  opacity: step.status === 'pending' ? 0.5 : 1,
                }}>
                  <i className={`ti ${stepIcon(step.status)}`} aria-hidden="true" style={{ fontSize: 13 }}/>
                  {step.label}
                </div>
              )
            })}
          </div>
        </div>

        {/* Compliance scores */}
        <div className="rc-card">
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 12 }}>
            Compliance overview
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {COMPLIANCE_DATA.map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--rc-text-secondary)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: c.color }}>{c.score}%</span>
                </div>
                <div style={{ height: 3, background: 'var(--rc-border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.score}%`, background: c.color, borderRadius: 2 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--rc-text-secondary)', marginBottom: 10 }}>
        Recent activity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {RECENT_ACTIVITY.map((act, i) => (
          <div key={i} className="rc-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', marginTop: 4, flexShrink: 0,
              background: act.type === 'critical' ? '#dc2626' : act.type === 'success' ? '#0d9488' : '#d97706',
            }}/>
            <div>
              <div style={{ fontSize: 11, color: 'var(--rc-text-secondary)', lineHeight: 1.5 }}>{act.text}</div>
              <div style={{ fontSize: 10, color: 'var(--rc-text-muted)', marginTop: 2 }}>
                {act.sub} · {act.time}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div style={{
        padding: 14,
        background: 'var(--rc-surface)',
        border: '0.5px solid var(--rc-border)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--rc-text-secondary)', marginBottom: 10 }}>
          Quick actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Run PII check',      icon: 'ti-shield-check',    module: 'm1-anonymiser',  color: '#7c3aed' },
            { label: 'Check Schedule Y',   icon: 'ti-scale',           module: 'm7-scheduley',   color: '#0d9488' },
            { label: 'Classify SAE case',  icon: 'ti-alert-triangle',  module: 'm4-classifier',  color: '#dc2626' },
            { label: 'Cross-doc analysis', icon: 'ti-files',           module: 'm9-crossdoc',    color: '#7c3aed' },
            { label: 'GCP compliance',     icon: 'ti-certificate',     module: 'm8-ichgcp',      color: '#0d9488' },
            { label: 'Regulatory Q&A',     icon: 'ti-message-question',module: 'm6-qa',          color: '#185fa5' },
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => onNavigate(action.module)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                border: '0.5px solid var(--rc-border)',
                background: 'var(--rc-surface-secondary)',
                cursor: 'pointer', fontSize: 12,
                color: 'var(--rc-text-secondary)',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <i className={`ti ${action.icon}`} aria-hidden="true" style={{ fontSize: 15, color: action.color, flexShrink: 0 }}/>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
