'use client'

export default function QuotaDisplay() {
  // Quota system was removed — show a simple workspace status
  if (typeof window === 'undefined') return null

  const name = typeof window !== 'undefined'
    ? localStorage.getItem('demo_name') || ''
    : ''

  return (
    <div style={{ padding: '12px 14px', borderTop: '0.5px solid var(--rc-border)' }}>
      {name && (
        <div style={{
          fontSize: 11,
          color: 'var(--rc-text-secondary)',
          marginBottom: 6,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {name}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--rc-text-muted)', lineHeight: 1.5 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#e1f5ee',
          color: '#0f6e56',
          padding: '2px 7px',
          borderRadius: 8,
          fontWeight: 500,
          fontSize: 10
        }}>
          <span style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: '#0d9488',
            display: 'inline-block'
          }}/>
          Active
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <a
          href="mailto:rushikeshbork000@gmail.com?subject=Full Access Request"
          style={{ color: '#0d9488', textDecoration: 'none', fontSize: 10 }}
        >
          Request full access →
        </a>
      </div>
    </div>
  )
}
