'use client'

import { useWorkspace } from '@/lib/workspaceStore'

interface NavItem {
  id: string
  label: string
  icon: string
  badge?: number
  isNew?: boolean
}

const PRIMARY: NavItem[] = [
  { id: 'home',           label: 'Home',                icon: 'ti-home-2' },
  { id: 'submissions',    label: 'Submissions',         icon: 'ti-folder-open',   badge: 12 },
  { id: 'applications',   label: 'Applications',        icon: 'ti-stack-2' },
  { id: 'registrations',  label: 'Registrations',       icon: 'ti-certificate' },
  { id: 'documents',      label: 'Documents',           icon: 'ti-file-text' },
  { id: 'correspondence', label: 'HA Correspondence',   icon: 'ti-mail',          badge: 3 },
  { id: 'audit',          label: 'Audit Trail',         icon: 'ti-clock-history' },
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

function Item({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`rc-nav-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      data-testid={`leftnav-${item.id}`}
    >
      <i className={`ti ${item.icon}`}/>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge !== undefined && <span className="rc-nav-item-badge">{item.badge}</span>}
      {item.isNew && <span className="rc-nav-item-new">NEW</span>}
    </button>
  )
}

export default function LeftNav() {
  const { activeView, setActiveView } = useWorkspace()

  return (
    <div className="rc-leftnav rc-scroll" data-testid="left-nav">
      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>Workspace</span>
        </div>
        {PRIMARY.map(item => (
          <Item key={item.id} item={item}
            active={activeView === item.id}
            onClick={() => setActiveView(item.id)}/>
        ))}
      </div>

      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>Compliance Agents</span>
          <i className="ti ti-sparkles" title="AI-assisted"
             style={{ fontSize: 13, color: '#1A56DB' }}/>
        </div>
        {AGENTS.map(item => (
          <Item key={item.id} item={item}
            active={activeView === item.id}
            onClick={() => setActiveView(item.id)}/>
        ))}
      </div>

      <div className="rc-nav-section">
        <div className="rc-nav-section-label">
          <span>System</span>
        </div>
        {SYSTEM.map(item => (
          <Item key={item.id} item={item}
            active={activeView === item.id}
            onClick={() => setActiveView(item.id)}/>
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
              v3.2.0 · Last sync 2 min ago
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
