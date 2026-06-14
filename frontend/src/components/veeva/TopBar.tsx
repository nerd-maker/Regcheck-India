'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useWorkspace } from '@/lib/workspaceStore'
// SPRINT5: removed mockup AUDIT_EVENTS
import { fetchCorrespondence, createSubmission } from '@/services/workspaceData'
import { fetchRecentActivity } from '@/services/api'
import type { HACorrespondenceRecord } from '@/lib/mockData'
import NewSubmissionModal from '@/components/NewSubmissionModal'

export default function TopBar() {
  const { setActiveView } = useWorkspace()
  const [search, setSearch] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showVault, setShowVault] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showNewSubmission, setShowNewSubmission] = useState(false)
  const [creating, setCreating] = useState(false)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const [correspondence, setCorrespondence] = useState<HACorrespondenceRecord[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetchCorrespondence().then(setCorrespondence)
  }, [])

  useEffect(() => {
    if (showNotif) {
      fetchRecentActivity(5)
        .then(data => setNotifications(data.activities || []))
        .catch(() => setNotifications([]))
    }
  }, [showNotif])

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) {
        setShowNotif(false); setShowVault(false); setShowUser(false); setShowQuick(false); setShowHelp(false)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      setActiveView('submissions')
    }
  }

  const handleCreateSubmission = async (formData: any) => {
    setCreating(true)
    try {
      await createSubmission(formData)
      setShowNewSubmission(false)
      setActiveView('submissions')
    } catch (err) {
      console.error('Failed to create:', err)
    } finally {
      setCreating(false)
    }
  }

  // Generate notifications from real recent activities
  const notifs = notifications.map(e => {
    let icon = 'ti-history'
    if (e.type === 'correspondence') {
      icon = 'ti-mail'
    } else if (e.type === 'agent_run') {
      icon = 'ti-sparkles'
    }
    
    let onClick = () => { setActiveView('audit-trail'); setShowNotif(false) }
    if (e.type === 'correspondence') {
      onClick = () => { setActiveView('correspondence'); setShowNotif(false) }
    }
    
    const tsFormatted = e.timestamp ? new Date(e.timestamp).toLocaleString('en-IN') : ''

    return {
      id: e.id,
      icon,
      title: e.label,
      meta: `${e.sublabel} · ${tsFormatted}`,
      onClick,
    }
  })

  return (
    <>
      <div className="rc-topbar" data-testid="top-app-bar" ref={notifRef}>
        <Link href="/" className="rc-topbar-logo" data-testid="topbar-logo">
          <span className="rc-topbar-logo-mark">R</span>
          <span>RegCheck<span style={{ opacity: 0.55, fontWeight: 400 }}>·India</span></span>
        </Link>

        <div style={{ position: 'relative' }}>
          <button className="rc-topbar-vault" onClick={(e) => { e.stopPropagation(); setShowVault(v => !v); setShowNotif(false); setShowUser(false); setShowQuick(false); setShowHelp(false) }} data-testid="topbar-vault-picker">
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
          {/* Fix 3: + opens New Submission modal */}
          <button
            className="rc-topbar-icon-btn"
            title="New submission"
            onClick={(e) => { e.stopPropagation(); setShowNewSubmission(true) }}
            data-testid="topbar-new-btn"
          >
            <i className="ti ti-plus"/>
          </button>

          {/* Fix 4: ⚡ Quick Actions dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="rc-topbar-icon-btn"
              title="Quick actions"
              onClick={(e) => {
                e.stopPropagation()
                setShowQuick(v => !v)
                setShowNotif(false)
                setShowVault(false)
                setShowUser(false)
                setShowHelp(false)
              }}
              data-testid="topbar-quick"
            >
              <i className="ti ti-bolt"/>
            </button>
            {showQuick && (
              <div
                style={{ ...popoverStyle, left: 'auto', right: 0, minWidth: 220 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={popoverHeader}>Quick Actions</div>
                {[
                  { icon: 'ti-folder-open',   label: 'New Submission',    action: () => { setShowNewSubmission(true); setShowQuick(false) } },
                  { icon: 'ti-file-text',     label: 'Go to Documents',   action: () => { setActiveView('documents');    setShowQuick(false) } },
                  { icon: 'ti-mail',          label: 'HA Correspondence', action: () => { setActiveView('correspondence'); setShowQuick(false) } },
                  { icon: 'ti-history', label: 'Audit Trail',       action: () => { setActiveView('audit-trail');  setShowQuick(false) } },
                  { icon: 'ti-chart-line',    label: 'Reports',           action: () => { setActiveView('reports');      setShowQuick(false) } },
                ].map(item => (
                  <button key={item.label} className="rc-nav-item" onClick={item.action}>
                    <i className={`ti ${item.icon}`}/>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              className="rc-topbar-icon-btn"
              title="Help & docs"
              onClick={(e) => {
                e.stopPropagation()
                setShowHelp(v => !v)
                setShowNotif(false)
                setShowVault(false)
                setShowUser(false)
                setShowQuick(false)
              }}
              data-testid="topbar-help"
            >
              <i className="ti ti-help-circle"/>
            </button>

            {showHelp && (
              <div
                style={{
                  ...popoverStyle,
                  left: 'auto',
                  right: 0,
                  width: 300,
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={popoverHeader}>Help & Resources</div>

                {[
                  {
                    icon: 'ti-book',
                    label: 'Getting started guide',
                    sub: 'Learn how to use RegCheck-India',
                    action: () => window.open(
                      'https://github.com/nerd-maker/Regcheck-India/blob/main/README.md',
                      '_blank'
                    ),
                  },
                  {
                    icon: 'ti-file-description',
                    label: 'Regulatory frameworks',
                    sub: 'Schedule Y, NDCTR 2019, ICH E6(R3)',
                    action: () => window.open(
                      'https://cdsco.gov.in/opencms/opencms/en/Regulations/Acts-Rules/',
                      '_blank'
                    ),
                  },
                  {
                    icon: 'ti-robot',
                    label: 'AI agents overview',
                    sub: '9 compliance agents and how to use them',
                    action: () => {
                      setActiveView('home')
                      setShowHelp(false)
                    },
                  },
                  {
                    icon: 'ti-keyboard',
                    label: 'Keyboard shortcuts',
                    sub: 'Enter: global search · Ctrl+N: new submission',
                    action: () => {},
                  },
                  {
                    icon: 'ti-mail',
                    label: 'Contact support',
                    sub: 'contact@regcheck.in',
                    action: () => window.open('mailto:contact@regcheck.in'),
                  },
                ].map(item => (
                  <button
                    key={item.label}
                    className="rc-nav-item"
                    onClick={item.action}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      paddingTop: 10,
                      paddingBottom: 10,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                    }}>
                      <i className={`ti ${item.icon}`}
                         style={{ color: 'var(--rc-primary)' }}/>
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--rc-text-primary)',
                      }}>
                        {item.label}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11,
                      color: 'var(--rc-text-muted)',
                      paddingLeft: 22,
                      marginTop: 2,
                    }}>
                      {item.sub}
                    </span>
                  </button>
                ))}

                <div style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--rc-divider)',
                  fontSize: 11,
                  color: 'var(--rc-text-muted)',
                  textAlign: 'center',
                }}>
                  RegCheck-India v1.0 Beta · 
                  <a
                    href="https://github.com/nerd-maker/Regcheck-India"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--rc-primary)',
                      textDecoration: 'none',
                      marginLeft: 4,
                    }}
                  >
                    GitHub ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="rc-topbar-icon-btn" title="Notifications" onClick={(e) => { e.stopPropagation(); setShowNotif(v => !v); setShowVault(false); setShowUser(false); setShowQuick(false); setShowHelp(false) }} data-testid="topbar-notifications">
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
            <div className="rc-topbar-user" onClick={(e) => { e.stopPropagation(); setShowUser(v => !v); setShowVault(false); setShowNotif(false); setShowQuick(false); setShowHelp(false) }} data-testid="topbar-user">
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

      {/* Fix 3: New Submission modal (rendered outside topbar to avoid stacking context issues) */}
      <NewSubmissionModal
        isOpen={showNewSubmission}
        onClose={() => setShowNewSubmission(false)}
        onCreate={handleCreateSubmission}
      />
    </>
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
