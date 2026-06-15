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
  const [activeHelpModal, setActiveHelpModal] = useState<'guide' | 'frameworks' | 'agents' | 'shortcuts' | 'support' | null>(null)
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setShowNewSubmission(true)
      }
      if (e.key === 'Escape') {
        setShowNotif(false)
        setShowVault(false)
        setShowUser(false)
        setShowQuick(false)
        setShowHelp(false)
        setShowNewSubmission(false)
        setActiveHelpModal(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
                    action: () => {
                      setActiveHelpModal('guide')
                      setShowHelp(false)
                    },
                  },
                  {
                    icon: 'ti-file-description',
                    label: 'Regulatory frameworks',
                    sub: 'Schedule Y, NDCTR 2019, ICH E6(R3)',
                    action: () => {
                      setActiveHelpModal('frameworks')
                      setShowHelp(false)
                    },
                  },
                  {
                    icon: 'ti-robot',
                    label: 'AI agents overview',
                    sub: '9 compliance agents and how to use them',
                    action: () => {
                      setActiveHelpModal('agents')
                      setShowHelp(false)
                    },
                  },
                  {
                    icon: 'ti-keyboard',
                    label: 'Keyboard shortcuts',
                    sub: 'Enter: global search · Ctrl+N: new submission',
                    action: () => {
                      setActiveHelpModal('shortcuts')
                      setShowHelp(false)
                    },
                  },
                  {
                    icon: 'ti-mail',
                    label: 'Contact support',
                    sub: 'contact@regcheck.in',
                    action: () => {
                      setActiveHelpModal('support')
                      setShowHelp(false)
                    },
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
                  <a
                    href="https://regcheck-india-three.vercel.app"
                    style={{
                      color: 'var(--rc-text-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    RegCheck-India v1.0 Beta
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

      {/* Help & Support Modals */}
      <HelpModal
        isOpen={activeHelpModal === 'guide'}
        onClose={() => setActiveHelpModal(null)}
        title="Getting Started Guide"
      >
        <div className="space-y-4">
          {[
            { step: 1, title: 'Upload a document', desc: 'Upload your clinical protocols or investigator brochures in the Documents vault.' },
            { step: 2, title: 'Trigger auto-compliance scan', desc: 'Transition the document state to "In Review" to kick off the background AI check.' },
            { step: 3, title: 'View compliance results', desc: 'Open the "Compliance Actions" tab in the right inspector to view flagged gaps and scores.' },
            { step: 4, title: 'Create a Submission', desc: 'Set up a dossier and link your documents to track overall compliance.' },
            { step: 5, title: 'Track HA Correspondence', desc: 'Log Health Authority queries and deficiency letters to keep track of due dates.' }
          ].map(item => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
                {item.step}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </HelpModal>

      <HelpModal
        isOpen={activeHelpModal === 'frameworks'}
        onClose={() => setActiveHelpModal(null)}
        title="Covered Regulatory Frameworks"
      >
        <div className="space-y-4">
          {[
            { name: 'Schedule Y (NDCTR 2019)', detail: 'Appendices I–VII detailing clinical trials and animal studies specifications.' },
            { name: 'ICH E6(R3) GCP', detail: 'Good Clinical Practice international standards for designing and conducting trials.' },
            { name: 'ICH E2A', detail: 'Clinical safety data management: definitions and standards for expedited reporting.' },
            { name: 'DPDP Act 2023', detail: 'Digital Personal Data Protection Act compliance requirements for PII handling.' },
            { name: 'CTRI Guidelines', detail: 'Clinical Trial Registry - India requirements for trial registration.' },
            { name: 'NDCTR 2019 Rule 87', detail: 'DCGI Serious Adverse Event (SAE) reporting timelines (24h to CDSCO/sponsor).' }
          ].map(item => (
            <div key={item.name} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{item.detail}</p>
            </div>
          ))}
        </div>
      </HelpModal>

      <HelpModal
        isOpen={activeHelpModal === 'agents'}
        onClose={() => setActiveHelpModal(null)}
        title="AI Compliance Agents Overview"
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          {[
            { name: 'PII Anonymiser', desc: 'DPDP Act 2023 + Schedule Y compliant redaction of personal data.' },
            { name: 'Document Summariser', desc: 'Precis with regulatory citations from CDSCO/international guidelines.' },
            { name: 'Completeness Check', desc: 'Identify CRITICAL / MAJOR / MINOR compliance gaps in dossiers.' },
            { name: 'Case Classifier', desc: 'ICH E2A · WHO-UMC · NDCTR timelines for SAE narrative assessment.' },
            { name: 'Inspection Report', desc: 'Generate GCP inspection reports in CDSCO-approved formats.' },
            { name: 'Regulatory Q&A', desc: 'RAG-grounded answers to queries using Indian regulations.' },
            { name: 'Schedule Y Check', desc: 'Evaluation against Appendices I–XI + NDCTR 2019 Rules 1–105.' },
            { name: 'ICH E6(R3) GCP', desc: 'Full GCP evaluation including R3 QMS + RBM specifications.' },
            { name: 'Cross-doc Check', desc: 'Detect contradictions and discrepancies across all documents.' }
          ].map(item => (
            <div key={item.name} className="flex justify-between items-start gap-4 py-1 border-b border-gray-50 last:border-0">
              <span className="font-semibold text-gray-900 text-xs min-w-[120px]">{item.name}</span>
              <span className="text-gray-500 text-xs text-right">{item.desc}</span>
            </div>
          ))}
        </div>
      </HelpModal>

      <HelpModal
        isOpen={activeHelpModal === 'shortcuts'}
        onClose={() => setActiveHelpModal(null)}
        title="Keyboard Shortcuts"
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 font-semibold text-gray-900">Shortcut Key</th>
              <th className="py-2 font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            <tr>
              <td className="py-3 pr-4"><span className="font-mono text-teal-600 bg-gray-50 px-2 py-1 rounded font-bold border border-gray-100">Enter</span></td>
              <td className="py-3 text-gray-600">Global search (trigger search from top bar)</td>
            </tr>
            <tr>
              <td className="py-3 pr-4"><span className="font-mono text-teal-600 bg-gray-50 px-2 py-1 rounded font-bold border border-gray-100">Ctrl + N</span></td>
              <td className="py-3 text-gray-600">Open new submission creation dialog</td>
            </tr>
            <tr>
              <td className="py-3 pr-4"><span className="font-mono text-teal-600 bg-gray-50 px-2 py-1 rounded font-bold border border-gray-100">Ctrl + U</span></td>
              <td className="py-3 text-gray-600">Trigger document upload dialog</td>
            </tr>
            <tr>
              <td className="py-3 pr-4"><span className="font-mono text-teal-600 bg-gray-50 px-2 py-1 rounded font-bold border border-gray-100">Escape</span></td>
              <td className="py-3 text-gray-600">Close current drawer panel or modal dialog</td>
            </tr>
          </tbody>
        </table>
      </HelpModal>

      <HelpModal
        isOpen={activeHelpModal === 'support'}
        onClose={() => setActiveHelpModal(null)}
        title="Contact Support"
      >
        <SupportForm onClose={() => setActiveHelpModal(null)} />
      </HelpModal>
    </>
  )
}

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

function HelpModal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: HelpModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pt-16 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div className={`relative w-full ${maxWidth} rounded-2xl bg-white shadow-2xl p-8 my-8`} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        </div>

        <div className="text-sm text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

function SupportForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      return
    }
    setStatus('submitting')
    try {
      const res = await fetch('https://formspree.io/f/REPLACE_WITH_FORMSPREE_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message, source: 'RegCheck-India Help Panel' }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Message sent!</p>
        <p className="text-xs text-gray-500">Message sent — we&apos;ll respond within 24 hours.</p>
        <button
          onClick={onClose}
          className="mt-6 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          placeholder="Anika Sharma"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          placeholder="anika@zephyrpharma.in"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          placeholder="How can we help you?"
        />
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-500">Failed to send message. Please try again or email us at contact@regcheck.in</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          disabled={status === 'submitting'}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {status === 'submitting' ? 'Sending...' : 'Submit'}
        </button>
      </div>
    </form>
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
