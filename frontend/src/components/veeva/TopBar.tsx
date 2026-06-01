'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/workspaceStore'
import { AUDIT_EVENTS } from '@/lib/mockData'
import { fetchCorrespondence } from '@/services/workspaceData'
import type { HACorrespondenceRecord } from '@/lib/mockData'

export default function TopBar() {
  const { setActiveView } = useWorkspace()
  const [search, setSearch] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showVault, setShowVault] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const [correspondence, setCorrespondence] = useState<HACorrespondenceRecord[]>([])

  useEffect(() => {
    fetchCorrespondence().then(setCorrespondence)
  }, [])

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) {
        setShowNotif(false); setShowVault(false); setShowUser(false)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      // Naive global search → take user to submissions with the term
      setActiveView('submissions')
    }
  }

  // Generate notifications from recent events + open HA correspondence
  const notifs = [
    ...correspondence.filter(c => c.state === 'open').slice(0, 2).map(c => ({
      id: `ha-${c.id}`, icon: 'ti-mail', title: c.subject,
      meta: `${c.authority} · ${c.priority === 'critical' ? '⚠ Critical' : 'Awaiting response'}`,
      onClick: () => { setActiveView('correspondence'); setShowNotif(false) },
    })),
    ...AUDIT_EVENTS.slice(0, 3).map(e => ({
      id: `ev-${e.id}`, icon: 'ti-history', title: e.action,
      meta: `${e.target} · ${e.ts}`,
      onClick: () => { setActiveView('audit'); setShowNotif(false) },
    })),
  ]

  return (
    <div className="rc-topbar" data-testid="top-app-bar" ref={notifRef}>
      <Link href="/" className="rc-topbar-logo" data-testid="topbar-logo">
        <span className="rc-topbar-logo-mark">R</span>
        <span>RegCheck<span style={{ opacity: 0.55, fontWeight: 400 }}>·India</span></span>
      </Link>

      <div style={{ position: 'relative' }}>
        <button className="rc-topbar-vault" onClick={(e) => { e.stopPropagation(); setShowVault(v => !v); setShowNotif(false); setShowUser(false) }} data-testid="topbar-vault-picker">
          <i className="ti ti-database"/>
          <span>India Regulatory Vault</span>
          <i className="ti ti-chevron-down" style={{ fontSize: 12 }}/>
        </button>
        {showVault && (
          <div style={popoverStyle} onClick={e => e.stopPropagation()}>
            <div style={popoverHeader}>Vaults</div>
            <button className="rc-nav-item is-active"><i className="ti ti-database"/> India Regulatory Vault</button>
            <button className="rc-nav-item" disabled style={{ opacity: 0.5 }}><i className="ti ti-lock"/> US FDA Vault <span className="rc-nav-item-badge">Soon</span></button>
            <button className="rc-nav-item" disabled style={{ opacity: 0.5 }}><i className="ti ti-lock"/> EU EMA Vault <span className="rc-nav-item-badge">Soon</span></button>
          </div>
        )}
      </div>

      <div className="rc-topbar-search">
        <i className="ti ti-search rc-topbar-search-icon"/>
        <input
          type="text"
          placeholder="Search submissions, documents, applications…  (Enter)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={onSearchKey}
          data-testid="topbar-global-search"
        />
      </div>

      <div className="rc-topbar-actions">
        <button className="rc-topbar-icon-btn" title="New submission" onClick={() => setActiveView('submissions')} data-testid="topbar-new-btn">
          <i className="ti ti-plus"/>
        </button>
        <button className="rc-topbar-icon-btn" title="Reports" onClick={() => setActiveView('reports')} data-testid="topbar-quick">
          <i className="ti ti-bolt"/>
        </button>
        <a className="rc-topbar-icon-btn" title="Help & docs" href="https://github.com/nerd-maker/Regcheck-India" target="_blank" rel="noopener noreferrer" data-testid="topbar-help">
          <i className="ti ti-help-circle"/>
        </a>
        <div style={{ position: 'relative' }}>
          <button className="rc-topbar-icon-btn" title="Notifications" onClick={(e) => { e.stopPropagation(); setShowNotif(v => !v); setShowVault(false); setShowUser(false) }} data-testid="topbar-notifications">
            <i className="ti ti-bell"/>
            {notifs.length > 0 && <span className="badge-dot"/>}
          </button>
          {showNotif && (
            <div style={{ ...popoverStyle, right: 0, left: 'auto', width: 340 }} onClick={e => e.stopPropagation()}>
              <div style={popoverHeader}>Notifications ({notifs.length})</div>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {notifs.map(n => (
                  <button key={n.id} className="rc-nav-item" onClick={n.onClick} style={{ flexDirection: 'column', alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <i className={`ti ${n.icon}`}/>
                      <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--rc-text-muted)', paddingLeft: 22 }}>{n.meta}</span>
                  </button>
                ))}
                {notifs.length === 0 && (
                  <div className="rc-empty" style={{ padding: 20 }}><i className="ti ti-bell-off"/><div style={{ fontSize: 12 }}>You&apos;re all caught up.</div></div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <div className="rc-topbar-user" onClick={(e) => { e.stopPropagation(); setShowUser(v => !v); setShowVault(false); setShowNotif(false) }} data-testid="topbar-user">
            <div className="rc-avatar" aria-hidden="true">AS</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Anika Sharma</div>
              <div style={{ fontSize: 10.5, opacity: 0.7 }}>Regulatory Lead</div>
            </div>
            <i className="ti ti-chevron-down" style={{ fontSize: 11, opacity: 0.7 }}/>
          </div>
          {showUser && (
            <div style={{ ...popoverStyle, right: 0, left: 'auto', width: 220 }} onClick={e => e.stopPropagation()}>
              <div style={{ ...popoverHeader, paddingBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rc-text-primary)' }}>Anika Sharma</div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontWeight: 400 }}>anika@zephyrpharma.in</div>
              </div>
              <button className="rc-nav-item" onClick={() => { setActiveView('settings'); setShowUser(false) }}><i className="ti ti-settings"/> Settings</button>
              <button className="rc-nav-item" onClick={() => { setActiveView('apikeys'); setShowUser(false) }}><i className="ti ti-key"/> API & Vaults</button>
              <button className="rc-nav-item" style={{ borderTop: '1px solid var(--rc-divider)', color: 'var(--rc-rejected)' }}><i className="ti ti-logout"/> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  background: 'var(--rc-surface)',
  border: '1px solid var(--rc-border)',
  borderRadius: 'var(--rc-radius-md)',
  boxShadow: 'var(--rc-shadow-md)',
  minWidth: 240,
  zIndex: 60,
  color: 'var(--rc-text-primary)',
}
const popoverHeader: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--rc-text-muted)',
  borderBottom: '1px solid var(--rc-divider)',
}
