'use client'

import { useEffect, useState, useCallback } from 'react'
import PageHeader from '@/components/veeva/PageHeader'
import {
  fetchRegulatoryUpdates,
  reviewRegulatoryUpdate,
  fetchRegulatoryUpdateCounts,
  triggerRegulatoryScape,
} from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegUpdate {
  id: number
  title: string
  source_url: string
  authority: string
  framework: string | null
  document_type: string
  publication_date: string | null
  summary: string | null
  status: string
  scraped_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  chunk_count: number | null
  error_message: string | null
}

type TabStatus = 'pending_review' | 'approved' | 'rejected' | 'ingested' | 'failed'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtRelative(iso: string | null) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const AUTHORITY_COLOR: Record<string, string> = {
  CDSCO: 'var(--rc-blue)',
  MoHFW: 'var(--rc-purple, #7c3aed)',
  ICH:   'var(--rc-teal, #0d9488)',
}

const DOC_TYPE_ICON: Record<string, string> = {
  circular:     'ti-bell-ringing',
  guidance:     'ti-book',
  notification: 'ti-speakerphone',
  order:        'ti-gavel',
  amendment:    'ti-edit',
}

// ─── Modal: Approve confirmation ──────────────────────────────────────────────

function ApproveModal({
  update,
  onConfirm,
  onCancel,
  loading,
}: {
  update: RegUpdate
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <i className="ti ti-circle-check" style={{ color: 'var(--rc-green)', fontSize: 22 }} />
          <span style={styles.modalTitle}>Approve Document</span>
        </div>
        <p style={styles.modalBody}>
          Add <strong>&quot;{update.title}&quot;</strong> to the AI knowledge base?
          This will make it available to all compliance agents immediately.
        </p>
        <div style={styles.modalMeta}>
          <span><i className="ti ti-building" /> {update.authority}</span>
          <span><i className="ti ti-tag" /> {update.document_type}</span>
          {update.chunk_count && <span><i className="ti ti-puzzle" /> ~{update.chunk_count} chunks</span>}
        </div>
        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button style={styles.btnApprove} onClick={onConfirm} disabled={loading}>
            {loading ? <><i className="ti ti-loader-2 ti-spin" /> Ingesting…</> : <>
              <i className="ti ti-circle-check" /> Approve & Ingest
            </>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Reject with reason ────────────────────────────────────────────────

function RejectModal({
  update,
  onConfirm,
  onCancel,
  loading,
}: {
  update: RegUpdate
  onConfirm: (reason: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <i className="ti ti-circle-x" style={{ color: 'var(--rc-red, #ef4444)', fontSize: 22 }} />
          <span style={styles.modalTitle}>Reject Document</span>
        </div>
        <p style={styles.modalBody}>
          Reject <strong>&quot;{update.title}&quot;</strong>? This document will not enter the knowledge base.
        </p>
        <textarea
          style={styles.textarea}
          placeholder="Reason for rejection (required)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
        />
        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            style={{ ...styles.btnReject, opacity: reason.trim() ? 1 : 0.5 }}
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
          >
            {loading ? <><i className="ti ti-loader-2 ti-spin" /> Rejecting…</> : <>
              <i className="ti ti-circle-x" /> Reject
            </>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      ...styles.toast,
      background: type === 'success' ? 'var(--rc-green)' : 'var(--rc-red, #ef4444)',
    }}>
      <i className={`ti ${type === 'success' ? 'ti-circle-check' : 'ti-alert-circle'}`} />
      {message}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function RegulatoryUpdatesView() {
  const [activeTab, setActiveTab] = useState<TabStatus>('pending_review')
  const [updates, setUpdates] = useState<RegUpdate[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [lastScraped, setLastScraped] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<RegUpdate | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RegUpdate | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const c = await fetchRegulatoryUpdateCounts()
      setCounts(c)
    } catch {
      /* non-fatal */
    }
  }, [])

  const loadUpdates = useCallback(async (status: TabStatus) => {
    setLoading(true)
    try {
      const data = await fetchRegulatoryUpdates(status)
      setUpdates(data.updates ?? [])
    } catch {
      setUpdates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUpdates(activeTab)
    loadCounts()
  }, [activeTab, loadUpdates, loadCounts])

  const handleApprove = async () => {
    if (!approveTarget) return
    setActionLoading(true)
    try {
      const result = await reviewRegulatoryUpdate(approveTarget.id, 'approved', 'Platform User')
      setToast({ message: `Approved! ${result.chunk_count ?? 0} chunks added to knowledge base.`, type: 'success' })
      setApproveTarget(null)
      loadUpdates(activeTab)
      loadCounts()
    } catch (err: any) {
      setToast({ message: err.message ?? 'Approval failed.', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return
    setActionLoading(true)
    try {
      await reviewRegulatoryUpdate(rejectTarget.id, 'rejected', 'Platform User', reason)
      setToast({ message: 'Document rejected.', type: 'success' })
      setRejectTarget(null)
      loadUpdates(activeTab)
      loadCounts()
    } catch (err: any) {
      setToast({ message: err.message ?? 'Rejection failed.', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleTriggerScrape = async () => {
    setScrapeLoading(true)
    try {
      await triggerRegulatoryScape()
      setLastScraped(new Date().toISOString())
      setToast({ message: 'Scraper triggered! New documents will appear within 2–5 minutes.', type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message ?? 'Failed to trigger scraper.', type: 'error' })
    } finally {
      setScrapeLoading(false)
    }
  }

  const TABS: Array<{ id: TabStatus; label: string }> = [
    { id: 'pending_review', label: 'Pending Review' },
    { id: 'ingested',       label: 'Approved' },
    { id: 'rejected',       label: 'Rejected' },
    { id: 'failed',         label: 'Failed' },
  ]

  const pendingCount = counts['pending_review'] ?? 0

  return (
    <div style={styles.page}>
      <PageHeader
        title="Regulatory Updates"
        subtitle="Automated intelligence feed from CDSCO, MoHFW, and ICH"
        icon="ti-satellite"
        badge={
          pendingCount > 0 ? (
            <span style={styles.headerBadge}>{pendingCount} pending</span>
          ) : undefined
        }
      />

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={styles.statsBar}>
        <StatCard icon="ti-clock-hour-3" label="Pending Review" value={counts['pending_review'] ?? 0} color="var(--rc-amber, #f59e0b)" />
        <StatCard icon="ti-circle-check" label="Ingested"       value={counts['ingested'] ?? 0}       color="var(--rc-green)" />
        <StatCard icon="ti-circle-x"     label="Rejected"       value={counts['rejected'] ?? 0}       color="var(--rc-red, #ef4444)" />
        <StatCard icon="ti-alert-circle" label="Failed"         value={counts['failed'] ?? 0}         color="var(--rc-text-muted)" />

        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {lastScraped && (
            <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>
              Last triggered: {fmtRelative(lastScraped)}
            </span>
          )}
          <button
            style={styles.scrapeBtn}
            onClick={handleTriggerScrape}
            disabled={scrapeLoading}
          >
            {scrapeLoading
              ? <><i className="ti ti-loader-2 ti-spin" /> Running…</>
              : <><i className="ti ti-refresh" /> Run Scraper Now</>
            }
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => { setActiveTab(tab.id); setExpandedId(null) }}
          >
            {tab.label}
            {counts[tab.id] ? (
              <span style={styles.tabBadge}>{counts[tab.id]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.emptyState}>
            <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: 'var(--rc-text-muted)' }} />
            <span style={{ color: 'var(--rc-text-muted)', marginTop: 8 }}>Loading…</span>
          </div>
        ) : updates.length === 0 ? (
          <div style={styles.emptyState}>
            <i className="ti ti-inbox" style={{ fontSize: 32, color: 'var(--rc-text-muted)' }} />
            <span style={{ color: 'var(--rc-text-muted)', marginTop: 8 }}>
              {activeTab === 'pending_review'
                ? 'No documents pending review. Run the scraper to fetch new regulatory documents.'
                : `No ${activeTab.replace('_', ' ')} documents.`}
            </span>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Document</th>
                <th style={styles.th}>Authority</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Scraped</th>
                <th style={styles.th}>Pub. Date</th>
                {activeTab === 'pending_review' && <th style={styles.th}>Actions</th>}
                {activeTab === 'ingested'       && <th style={styles.th}>Chunks</th>}
                {activeTab === 'rejected'       && <th style={styles.th}>Reason</th>}
                {activeTab === 'failed'         && <th style={styles.th}>Error</th>}
              </tr>
            </thead>
            <tbody>
              {updates.map(u => (
                <>
                  <tr
                    key={u.id}
                    style={styles.tr}
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  >
                    {/* Title + summary */}
                    <td style={{ ...styles.td, maxWidth: 380 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <i
                          className={`ti ${DOC_TYPE_ICON[u.document_type] ?? 'ti-file'}`}
                          style={{ marginTop: 2, color: 'var(--rc-text-muted)', flexShrink: 0 }}
                        />
                        <div>
                          <div style={styles.titleText}>{u.title}</div>
                          {u.summary && (
                            <div style={styles.summaryText}>{u.summary.slice(0, 120)}{u.summary.length > 120 ? '…' : ''}</div>
                          )}
                          <a
                            href={u.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.urlLink}
                            onClick={e => e.stopPropagation()}
                          >
                            <i className="ti ti-external-link" /> Source
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Authority */}
                    <td style={styles.td}>
                      <span style={{
                        ...styles.authorityPill,
                        borderColor: AUTHORITY_COLOR[u.authority] ?? 'var(--rc-divider)',
                        color: AUTHORITY_COLOR[u.authority] ?? 'var(--rc-text-muted)',
                      }}>
                        {u.authority}
                      </span>
                    </td>

                    {/* Type */}
                    <td style={styles.td}>
                      <span style={styles.typePill}>{u.document_type}</span>
                    </td>

                    {/* Scraped */}
                    <td style={{ ...styles.td, color: 'var(--rc-text-muted)', fontSize: 12 }}>
                      {fmtRelative(u.scraped_at)}
                    </td>

                    {/* Pub date */}
                    <td style={{ ...styles.td, color: 'var(--rc-text-muted)', fontSize: 12 }}>
                      {fmtDate(u.publication_date)}
                    </td>

                    {/* Action column */}
                    {activeTab === 'pending_review' && (
                      <td style={styles.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={styles.btnApproveSmall}
                            title="Approve"
                            onClick={() => setApproveTarget(u)}
                          >
                            <i className="ti ti-check" /> Approve
                          </button>
                          <button
                            style={styles.btnRejectSmall}
                            title="Reject"
                            onClick={() => setRejectTarget(u)}
                          >
                            <i className="ti ti-x" /> Reject
                          </button>
                        </div>
                      </td>
                    )}
                    {activeTab === 'ingested' && (
                      <td style={{ ...styles.td, color: 'var(--rc-green)', fontWeight: 600 }}>
                        {u.chunk_count ?? '—'}
                      </td>
                    )}
                    {activeTab === 'rejected' && (
                      <td style={{ ...styles.td, color: 'var(--rc-text-muted)', fontSize: 12, maxWidth: 200 }}>
                        {u.rejection_reason ?? '—'}
                      </td>
                    )}
                    {activeTab === 'failed' && (
                      <td style={{ ...styles.td, color: 'var(--rc-red, #ef4444)', fontSize: 12, maxWidth: 200 }}>
                        {u.error_message ?? '—'}
                      </td>
                    )}
                  </tr>

                  {/* Expanded row — full summary */}
                  {expandedId === u.id && (
                    <tr key={`${u.id}-exp`} style={{ background: 'var(--rc-surface-alt, rgba(255,255,255,0.02))' }}>
                      <td colSpan={6} style={{ padding: '12px 24px 16px' }}>
                        <div style={styles.expandedContent}>
                          {u.summary && (
                            <div>
                              <div style={styles.expandedLabel}>AI Summary</div>
                              <p style={styles.expandedText}>{u.summary}</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {u.framework && (
                              <div>
                                <div style={styles.expandedLabel}>Framework</div>
                                <div style={styles.expandedText}>{u.framework}</div>
                              </div>
                            )}
                            {u.reviewed_by && (
                              <div>
                                <div style={styles.expandedLabel}>Reviewed by</div>
                                <div style={styles.expandedText}>{u.reviewed_by} on {fmtDate(u.reviewed_at)}</div>
                              </div>
                            )}
                            {u.rejection_reason && (
                              <div>
                                <div style={styles.expandedLabel}>Rejection Reason</div>
                                <div style={{ ...styles.expandedText, color: 'var(--rc-red, #ef4444)' }}>{u.rejection_reason}</div>
                              </div>
                            )}
                          </div>
                          <a
                            href={u.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...styles.urlLink, fontSize: 12 }}
                          >
                            <i className="ti ti-external-link" /> {u.source_url}
                          </a>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {approveTarget && (
        <ApproveModal
          update={approveTarget}
          onConfirm={handleApprove}
          onCancel={() => setApproveTarget(null)}
          loading={actionLoading}
        />
      )}
      {rejectTarget && (
        <RejectModal
          update={rejectTarget}
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string
}) {
  return (
    <div style={styles.statCard}>
      <i className={`ti ${icon}`} style={{ color, fontSize: 20 }} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--rc-text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 24px',
    borderBottom: '1px solid var(--rc-divider)',
    background: 'var(--rc-surface)',
    flexWrap: 'wrap',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    background: 'var(--rc-bg)',
    borderRadius: 8,
    border: '1px solid var(--rc-divider)',
  },
  scrapeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'var(--rc-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '0 24px',
    borderBottom: '1px solid var(--rc-divider)',
    background: 'var(--rc-surface)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    color: 'var(--rc-text-muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'var(--rc-blue)',
    borderBottomColor: 'var(--rc-blue)',
  },
  tabBadge: {
    background: 'var(--rc-blue)',
    color: '#fff',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
  },
  tableWrap: {
    flex: 1,
    overflow: 'auto',
    padding: '0 0 24px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--rc-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--rc-divider)',
    background: 'var(--rc-surface)',
    position: 'sticky',
    top: 0,
  },
  tr: {
    borderBottom: '1px solid var(--rc-divider)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    verticalAlign: 'top',
    color: 'var(--rc-text-primary)',
  },
  titleText: {
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--rc-text-primary)',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  summaryText: {
    fontSize: 11.5,
    color: 'var(--rc-text-muted)',
    lineHeight: 1.4,
    marginBottom: 4,
  },
  urlLink: {
    fontSize: 11,
    color: 'var(--rc-blue)',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  },
  authorityPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid',
    letterSpacing: '0.03em',
  },
  typePill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--rc-surface-alt, rgba(255,255,255,0.05))',
    color: 'var(--rc-text-muted)',
    border: '1px solid var(--rc-divider)',
    textTransform: 'capitalize',
  },
  btnApproveSmall: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    background: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--rc-green)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnRejectSmall: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--rc-red, #ef4444)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    color: 'var(--rc-text-muted)',
    fontSize: 13,
    gap: 4,
  },
  headerBadge: {
    background: 'var(--rc-amber, #f59e0b)',
    color: '#fff',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--rc-surface)',
    borderRadius: 12,
    border: '1px solid var(--rc-divider)',
    padding: 28,
    width: 440,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--rc-text-primary)',
  },
  modalBody: {
    fontSize: 13.5,
    color: 'var(--rc-text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  modalMeta: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: 'var(--rc-text-muted)',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btnSecondary: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid var(--rc-divider)',
    borderRadius: 7,
    color: 'var(--rc-text-muted)',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnApprove: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    background: 'var(--rc-green)',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnReject: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    background: 'var(--rc-red, #ef4444)',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--rc-bg)',
    border: '1px solid var(--rc-divider)',
    borderRadius: 7,
    color: 'var(--rc-text-primary)',
    fontSize: 13,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    zIndex: 2000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    animation: 'fadeInUp 0.2s ease',
  },
  expandedContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  expandedLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rc-text-muted)',
    marginBottom: 3,
  },
  expandedText: {
    fontSize: 13,
    color: 'var(--rc-text-primary)',
    lineHeight: 1.5,
  },
}
