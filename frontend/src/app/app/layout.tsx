'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import '../../styles/platform.css'
import OnboardingTooltip from '@/components/OnboardingTooltip'
import PinnedResultPanel from '@/components/PinnedResultPanel'
import QuotaDisplay from '@/components/QuotaDisplay'
import ModuleRenderer from '@/components/ModuleRenderer'

// ── Navigation config ─────────────────────────────────────────────────────────

const WORKSPACE_NAV = [
  { id: 'dashboard',    label: 'Overview',     icon: 'ti-layout-dashboard' },
  { id: 'submissions',  label: 'Submissions',  icon: 'ti-folder-open',      badge: 3 },
  { id: 'documents',    label: 'Documents',    icon: 'ti-file-text' },
  { id: 'audit',        label: 'Audit trail',  icon: 'ti-clock-history' },
]

const AGENT_NAV = [
  { id: 'm1-anonymiser',   label: 'PII anonymiser',       icon: 'ti-shield-check' },
  { id: 'm2-summariser',   label: 'Document summariser',  icon: 'ti-file-description' },
  { id: 'm3-completeness', label: 'Completeness check',   icon: 'ti-checklist' },
  { id: 'm4-classifier',   label: 'Case classifier',      icon: 'ti-alert-triangle' },
  { id: 'm5-inspection',   label: 'Inspection report',    icon: 'ti-report' },
  { id: 'm6-qa',           label: 'Regulatory Q&A',       icon: 'ti-message-question' },
  { id: 'm7-scheduley',    label: 'Schedule Y',           icon: 'ti-scale' },
  { id: 'm8-ichgcp',       label: 'ICH E6(R3) GCP',      icon: 'ti-certificate' },
  { id: 'm9-crossdoc',     label: 'Cross-doc check',      icon: 'ti-files', badgeNew: true },
]

const SETTINGS_NAV = [
  { id: 'settings', label: 'Preferences', icon: 'ti-settings' },
  { id: 'apikeys',  label: 'API keys',    icon: 'ti-key' },
]

// ── Sidebar nav button ────────────────────────────────────────────────────────

interface NavBtnProps {
  id: string
  label: string
  icon: string
  active: boolean
  badge?: number
  badgeNew?: boolean
  onClick: () => void
}

function NavBtn({ id, label, icon, active, badge, badgeNew, onClick }: NavBtnProps) {
  return (
    <button
      key={id}
      onClick={onClick}
      className={`rc-nav-btn${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}/>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: 10, background: '#0d948820', color: '#0d9488',
          padding: '1px 6px', borderRadius: 10,
        }}>{badge}</span>
      )}
      {badgeNew && (
        <span style={{
          fontSize: 9, background: '#7c3aed20', color: '#7c3aed',
          padding: '1px 5px', borderRadius: 8, fontWeight: 600,
        }}>NEW</span>
      )}
    </button>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState('dashboard')
  const [orgName, setOrgName] = useState('My workspace')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const org = localStorage.getItem('demo_org') || 'RegCheck Demo'
    setOrgName(org)
  }, [])

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</div>
      </div>
    )
  }

  const TOP_NAV = ['Dashboard', 'Submissions', 'Documents', 'Reports']

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: sidebarOpen ? '220px 1fr' : '0px 1fr',
        gridTemplateRows: '48px 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--rc-surface-tertiary)',
        transition: 'grid-template-columns 0.2s ease',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--rc-surface)',
        borderBottom: '0.5px solid var(--rc-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        zIndex: 10,
        minWidth: 0,
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rc-text-secondary)', padding: 4, flexShrink: 0 }}
          aria-label="Toggle sidebar"
        >
          <i className="ti ti-menu-2" aria-hidden="true" style={{ fontSize: 18 }}/>
        </button>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, background: '#0d9488', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>R</div>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--rc-text-primary)' }}>
            RegCheck<span style={{ color: 'var(--rc-text-muted)' }}>-India</span>
          </span>
        </Link>

        {/* Top nav pills */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          {TOP_NAV.map(label => {
            const id = label.toLowerCase()
            const active = activeModule === id
            return (
              <button
                key={label}
                onClick={() => setActiveModule(id)}
                style={{
                  padding: '4px 10px', fontSize: 12, borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? 'var(--rc-surface-secondary)' : 'transparent',
                  color: active ? 'var(--rc-text-primary)' : 'var(--rc-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button className="rc-btn" style={{ fontSize: 12 }}>
            <i className="ti ti-building" aria-hidden="true" style={{ marginRight: 4 }}/>
            {orgName}
          </button>
          <button
            className="rc-btn rc-btn-primary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setActiveModule('m3-completeness')}
          >
            <i className="ti ti-plus" aria-hidden="true"/>
            New submission
          </button>
        </div>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div
        className="rc-scroll"
        style={{
          background: 'var(--rc-surface-secondary)',
          borderRight: '0.5px solid var(--rc-border)',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          visibility: sidebarOpen ? 'visible' : 'hidden',
        }}
      >
        <div style={{ padding: '12px 0', flex: 1 }}>
          {/* Workspace */}
          <span className="rc-section-label" style={{ marginTop: 8 }}>Workspace</span>
          {WORKSPACE_NAV.map(item => (
            <NavBtn
              key={item.id}
              {...item}
              active={activeModule === item.id}
              onClick={() => setActiveModule(item.id)}
            />
          ))}

          {/* Compliance Agents */}
          <span className="rc-section-label">Compliance agents</span>
          {AGENT_NAV.map(item => (
            <NavBtn
              key={item.id}
              {...item}
              active={activeModule === item.id}
              onClick={() => setActiveModule(item.id)}
            />
          ))}

          {/* Settings */}
          <span className="rc-section-label">Settings</span>
          {SETTINGS_NAV.map(item => (
            <NavBtn
              key={item.id}
              {...item}
              active={activeModule === item.id}
              onClick={() => setActiveModule(item.id)}
            />
          ))}
        </div>

        {/* Sidebar footer */}
        <QuotaDisplay />
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div
        className="rc-scroll"
        style={{ overflowY: 'auto', background: 'var(--rc-surface-tertiary)' }}
      >
        <ModuleRenderer activeModule={activeModule} setActiveModule={setActiveModule} />
        {/* children is the page.tsx — empty stub, rendered here for Next.js */}
        {children}
      </div>

      <OnboardingTooltip />
      <PinnedResultPanel />
    </div>
  )
}
