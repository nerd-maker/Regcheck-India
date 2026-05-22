'use client'

import { ReactNode } from 'react'

interface Crumb {
  label: string
  onClick?: () => void
}

interface PageHeaderProps {
  crumbs?: Crumb[]
  title: string
  subtitle?: string
  icon?: string                 // tabler icon name e.g. 'ti-folder-open'
  badge?: ReactNode             // status pill etc
  actions?: ReactNode
  tabs?: { id: string; label: string; count?: number }[]
  activeTab?: string
  onTabChange?: (id: string) => void
}

export default function PageHeader({
  crumbs = [], title, subtitle, icon, badge, actions, tabs, activeTab, onTabChange,
}: PageHeaderProps) {
  return (
    <>
      <div className="rc-page-header" data-testid="page-header">
        {crumbs.length > 0 && (
          <div className="rc-breadcrumbs">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span className="sep">/</span>}
                {i === crumbs.length - 1 ? (
                  <span className="current">{c.label}</span>
                ) : c.onClick ? (
                  <button onClick={c.onClick}>{c.label}</button>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="rc-page-title">
              {icon && <i className={`ti ${icon}`} style={{ fontSize: 20, color: 'var(--rc-primary)' }}/>}
              <span>{title}</span>
              {badge}
            </div>
            {subtitle && <div className="rc-page-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="rc-page-actions">{actions}</div>}
        </div>
      </div>

      {tabs && tabs.length > 0 && (
        <div className="rc-subbar" data-testid="page-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`rc-subbar-tab${activeTab === t.id ? ' is-active' : ''}`}
              onClick={() => onTabChange?.(t.id)}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  background: activeTab === t.id ? 'var(--rc-primary-soft)' : 'var(--rc-surface-tertiary)',
                  color: activeTab === t.id ? 'var(--rc-primary)' : 'var(--rc-text-muted)',
                  padding: '1px 6px', borderRadius: 8,
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
