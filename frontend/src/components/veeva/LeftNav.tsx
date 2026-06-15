'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSubmissions, useCorrespondence } from '@/hooks/useWorkspaceData'

interface NavItem {
  id: string
  label: string
  icon: string
  badge?: number
  isNew?: boolean
}

const PRIMARY: NavItem[] = [
  { id: 'home',           label: 'Home',                icon: 'ti-home-2' },
  { id: 'submissions',    label: 'Submissions',         icon: 'ti-folder-open' },
  { id: 'applications',   label: 'Applications',        icon: 'ti-stack-2' },
  { id: 'registrations',  label: 'Registrations',       icon: 'ti-certificate' },
  { id: 'documents',      label: 'Documents',           icon: 'ti-file-text' },
  { id: 'correspondence', label: 'HA Correspondence',   icon: 'ti-mail' },
  { id: 'audit-trail',    label: 'Audit Trail',         icon: 'ti-history' },
  { id: 'reports',        label: 'Reports',             icon: 'ti-chart-line' },
]

const AGENTS: NavItem[] = [
  { id: 'm1-anonymiser',   label: 'PII Anonymiser',       icon: 'ti-shield-check' },
  { id: 'm2-summariser',   label: 'Document Summariser',  icon: 'ti-file-description' },
  { id: 'm3-completeness', label: 'Completeness Check',   icon: 'ti-checklist' },
  { id: 'm4-classifier',   label: 'Case Classifier',      icon: 'ti-alert-triangle' },
  { id: 'm5-inspection',   label: 'Inspection Report',    icon: 'ti-report' },
  { id: 'm6-qa',           label: 'Regulatory Q&A',       icon: 'ti-message-question' },
  { id: 'm7-scheduley',    label: 'Schedule Y Check',     icon: 'ti-scale' },
  { id: 'm8-ichgcp',       label: 'ICH E6(R3) GCP',       icon: 'ti-certificate-2' },
  { id: 'm9-crossdoc',     label: 'Cross-doc Check',      icon: 'ti-files', isNew: true },
]

const SYSTEM: NavItem[] = [
  { id: 'settings', label: 'Settings',     icon: 'ti-settings' },
  { id: 'apikeys',  label: 'API & Vaults', icon: 'ti-key' },
]

function getHref(id: string) {
  if (id === 'home') return '/app'
  if (id === 'settings') return '/app/settings'
  if (id === 'apikeys') return '/app/api-vaults'
  if (id === 'm1-anonymiser') return '/app/agents/pii-anonymiser'
  if (id === 'm2-summariser') return '/app/agents/document-summariser'
  if (id === 'm3-completeness') return '/app/agents/completeness-check'
  if (id === 'm4-classifier') return '/app/agents/case-classifier'
  if (id === 'm5-inspection') return '/app/agents/inspection-report'
  if (id === 'm6-qa') return '/app/agents/regulatory-qa'
  if (id === 'm7-scheduley') return '/app/agents/schedule-y-check'
  if (id === 'm8-ichgcp') return '/app/agents/ich-e6r3-gcp'
  if (id === 'm9-crossdoc') return '/app/agents/cross-doc-check'
  return `/app/${id}`
}

function Item({ item, active, href }: { item: NavItem; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rc-nav-item${active ? ' is-active' : ''}`}
      data-testid={`leftnav-${item.id}`}
      style={{ textDecoration: 'none', display: 'flex', width: '100%', alignItems: 'center' }}
    >
      <i className={`ti ${item.icon}`}/>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge !== undefined && <span className="rc-nav-item-badge">{item.badge}</span>}
      {item.isNew && <span className="rc-nav-item-new">NEW</span>}
    </Link>
  )
}

export default function LeftNav() {
  const pathname = usePathname()

  // Dynamic badge counts from live data
  const { data: submissions, reload: reloadSubmissions } = useSubmissions()
  const { data: correspondence, reload: reloadCorrespondence } = useCorrespondence()

  useEffect(() => {
    reloadSubmissions()
    reloadCorrespondence()
  }, [pathname, reloadSubmissions, reloadCorrespondence])

  const submissionCount = submissions.length
  const openCorrCount = correspondence.filter(
    c => c.state === 'open' || c.state === 'response-drafted'
  ).length

  const isActive = (item: NavItem) => {
    const href = getHref(item.id)
    if (item.id === 'home') {
      return pathname === '/app'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="rc-leftnav rc-scroll" data-testid="left-nav">
      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>Workspace</span>
        </div>
        {PRIMARY.map(item => {
          const badge =
            item.id === 'submissions'    ? (submissionCount || undefined) :
            item.id === 'correspondence' ? (openCorrCount   || undefined) :
            undefined
          return (
            <Item key={item.id} item={{ ...item, badge }}
              active={isActive(item)}
              href={getHref(item.id)}/>
          )
        })}
      </div>

      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>Compliance Agents</span>
          <i className="ti ti-sparkles" title="AI-assisted"
             style={{ fontSize: 13, color: '#1A56DB' }}/>
        </div>
        {AGENTS.map(item => (
          <Item key={item.id} item={item}
            active={isActive(item)}
            href={getHref(item.id)}/>
        ))}
      </div>

      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>System</span>
        </div>
        {SYSTEM.map(item => (
          <Item key={item.id} item={item}
            active={isActive(item)}
            href={getHref(item.id)}/>
        ))}
      </div>

      {/* Vault status footer */}
      <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid var(--rc-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rc-green)' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--rc-text-primary)' }}>
              Vault operational
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)' }}>
              v1.0 Beta
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

