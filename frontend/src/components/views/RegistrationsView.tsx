'use client'

import { useState, useMemo } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'
import { useRegistrations, useApplications, useSubmissions } from '@/hooks/useWorkspaceData'
import { createRegistration } from '@/services/api'
import type { RegistrationRecord } from '@/types/workspace'

const STATE_COLOR: Record<string, { bg: string; color: string }> = {
  'Effective':       { bg: 'var(--rc-approved-bg)',   color: 'var(--rc-approved)' },
  'Expiring Soon':   { bg: 'var(--rc-review-bg)',     color: 'var(--rc-review)' },
  'Expired':         { bg: 'var(--rc-rejected-bg)',   color: 'var(--rc-rejected)' },
  'Withdrawn':       { bg: 'var(--rc-superseded-bg)', color: 'var(--rc-superseded)' },
}

export default function RegistrationsView() {
  const { setActiveView, setSelectedSubmissionId, openInspector } = useWorkspace()
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: registrations, loading, reload } = useRegistrations()
  const { data: applications } = useApplications()
  const { data: submissions } = useSubmissions()

  const STATE_OPTS = ['Effective', 'Expiring Soon', 'Expired', 'Withdrawn']

  const handleCreate = async (payload: any) => {
    await createRegistration(payload)
    await reload()
  }

  const handleRowClick = (reg: RegistrationRecord) => {
    const linkedSub = submissions.find(s => s.applicationId === reg.applicationId || s.product === reg.product)
    if (linkedSub) {
      setSelectedSubmissionId(linkedSub.id)
      openInspector('details')
    } else {
      openInspector('details')
    }
  }

  const filtered = useMemo(() => registrations.filter(r => {
    if (active.state && r.state !== active.state) return false
    if (search && !`${r.number} ${r.product} ${r.certificate}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [registrations, active, search])

  return (
    <div data-testid="view-registrations">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Registrations' }]}
        title="Registrations"
        subtitle={`${filtered.length} of ${registrations.length} active product registrations · India`}
        icon="ti-certificate"
        actions={
          <>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_registrations'),
              filtered.map(r => ({ number: r.number, product: r.product, certificate: r.certificate, market: r.market, state: r.state, approved: r.approvedDate, expires: r.expiryDate }))
            )} data-testid="regs-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary" onClick={() => setShowCreateModal(true)} data-testid="regs-new-btn"><i className="ti ti-plus"/> New registration</button>
          </>
        }
      />
      <FilterBar
        active={active}
        onChange={setActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search number, product, certificate…"
        filters={[
          { key: 'state', label: 'State', chips: STATE_OPTS.map(s => ({ id: s, label: s, count: registrations.filter(r => r.state === s).length })) },
        ]}
      />
      <div style={{ padding: 24 }}>
          {loading && (
            <div className="rc-card" style={{ marginBottom: 12 }}>
              <div className="rc-empty"><i className="ti ti-loader-2 animate-spin"/><div>Loading registrations...</div></div>
            </div>
          )}
          <div className="rc-card">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Product</th>
                  <th>Certificate</th>
                  <th>Market</th>
                  <th>State</th>
                  <th>Approved</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = STATE_COLOR[r.state] || { bg: 'var(--rc-surface-tertiary)', color: 'var(--rc-text-secondary)' }
                  return (
                    <tr key={r.id} data-testid={`regrow-${r.id}`} onClick={() => handleRowClick(r)} style={{ cursor: 'pointer' }}>
                      <td><span className="rc-table-link" style={{ fontFamily: 'var(--rc-font-mono)', fontSize: 12 }}>{r.number}</span></td>
                      <td><strong>{r.product}</strong></td>
                      <td>{r.certificate}</td>
                      <td>{r.market}</td>
                      <td><span className="rc-pill" style={{ background: st.bg, color: st.color }}>{r.state}</span></td>
                      <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{r.approvedDate}</span></td>
                      <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{r.expiryDate}</span></td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><div className="rc-empty"><i className="ti ti-search-off"/><div>No registrations match the filters.</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
      <NewRegistrationModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreate} applications={applications} />
    </div>
  )
}

function NewRegistrationModal({ isOpen, onClose, onCreate, applications }: {
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: { product: string; certificate: string; market: string; application_id?: string; approved_date: string; expiry_date: string }) => Promise<void>
  applications: any[]
}) {
  const [product, setProduct] = useState('')
  const [certificate, setCertificate] = useState('Marketing Authorization')
  const [market, setMarket] = useState('India')
  const [applicationId, setApplicationId] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAppChange = (appId: string) => {
    setApplicationId(appId)
    const app = applications.find(a => a.id === appId)
    if (app) {
      setProduct(app.product)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product.trim() || !certificate.trim() || !market.trim() || !approvedDate || !expiryDate) {
      setError('All fields except Application ID are required.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onCreate({
        product: product.trim(),
        certificate,
        market: market.trim(),
        application_id: applicationId || undefined,
        approved_date: approvedDate,
        expiry_date: expiryDate,
      })
      onClose()
      setProduct('')
      setCertificate('Marketing Authorization')
      setMarket('India')
      setApplicationId('')
      setApprovedDate('')
      setExpiryDate('')
    } catch (err: any) {
      setError(err.message || 'Failed to create registration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-16 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 my-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create New Registration</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-gray-800">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Application (Optional)</label>
            <select className="rc-input w-full text-black" value={applicationId} onChange={e => handleAppChange(e.target.value)}>
              <option value="">-- Select Application --</option>
              {applications.map(app => (
                <option key={app.id} value={app.id}>{app.number} — {app.product}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input className="rc-input w-full text-black" value={product} onChange={e => setProduct(e.target.value)} required placeholder="e.g. BX-400 Injection" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Type *</label>
            <select className="rc-input w-full text-black" value={certificate} onChange={e => setCertificate(e.target.value)}>
              <option value="Marketing Authorization">Marketing Authorization</option>
              <option value="Import License">Import License</option>
              <option value="Manufacturing License">Manufacturing License</option>
              <option value="GMP Certificate">GMP Certificate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Market *</label>
            <input className="rc-input w-full text-black" value={market} onChange={e => setMarket(e.target.value)} required placeholder="e.g. India" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved Date *</label>
            <input type="date" className="rc-input w-full text-black" value={approvedDate} onChange={e => setApprovedDate(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
            <input type="date" className="rc-input w-full text-black" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="rc-btn">Cancel</button>
            <button type="submit" disabled={submitting} className="rc-btn rc-btn-primary">
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
