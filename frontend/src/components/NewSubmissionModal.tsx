'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreate?: (data: {
    name: string
    type: string
    product: string
    indication: string
    phase: string
    ha_authority: string
    target_submit_date: string
    owner_name: string
    owner_initials: string
  }) => Promise<void>
}

export default function NewSubmissionModal({ isOpen, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [product, setProduct] = useState('')
  const [type, setType] = useState('IND')
  const [phase, setPhase] = useState('Phase II')
  const [indication, setIndication] = useState('')
  const [haAuthority, setHaAuthority] = useState('CDSCO')
  const [targetSubmitDate, setTargetSubmitDate] = useState(() => {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  const [ownerName, setOwnerName] = useState('')
  const [ownerInitials, setOwnerInitials] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !product.trim() || !indication.trim() || !ownerName.trim() || !ownerInitials.trim()) {
      setError('Name, Product, Indication, Owner Name, and Owner Initials are required.')
      return
    }
    if (ownerInitials.length > 5) {
      setError('Owner Initials must be 5 characters or less.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      if (onCreate) {
        await onCreate({
          name: name.trim(),
          type,
          product: product.trim(),
          indication: indication.trim(),
          phase,
          ha_authority: haAuthority,
          target_submit_date: targetSubmitDate,
          owner_name: ownerName.trim(),
          owner_initials: ownerInitials.trim().toUpperCase(),
        })
      } else {
        alert(`Submission created: ${name} — ${product} — ${type}`)
      }
      onClose()
      // Reset state
      setName('')
      setProduct('')
      setIndication('')
      setOwnerName('')
      setOwnerInitials('')
    } catch (err: any) {
      setError(err.message || 'Failed to create submission.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-16 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="New Submission"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 my-8" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create New Submission</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create a new regulatory submission record. It will initialize in Draft state.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-name">
              Submission Name *
            </label>
            <input
              id="sub-name"
              type="text"
              placeholder="e.g. ZP-101 Phase II CT Permission"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-type">
                Type *
              </label>
              <select
                id="sub-type"
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="IND">IND</option>
                <option value="NDA">NDA</option>
                <option value="CT-04">CT-04</option>
                <option value="Schedule M">Schedule M</option>
                <option value="ANDA">ANDA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-phase">
                Phase *
              </label>
              <select
                id="sub-phase"
                value={phase}
                onChange={e => setPhase(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Pre-IND">Pre-IND</option>
                <option value="Phase I">Phase I</option>
                <option value="Phase II">Phase II</option>
                <option value="Phase III">Phase III</option>
                <option value="Post-approval">Post-approval</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-product">
                Drug / Product Name *
              </label>
              <input
                id="sub-product"
                type="text"
                placeholder="e.g. ZP-101"
                value={product}
                onChange={e => setProduct(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-ha-authority">
                HA Authority *
              </label>
              <select
                id="sub-ha-authority"
                value={haAuthority}
                onChange={e => setHaAuthority(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="CDSCO">CDSCO</option>
                <option value="DCGI">DCGI</option>
                <option value="SLA">SLA</option>
                <option value="CPCB">CPCB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-indication">
              Indication *
            </label>
            <input
              id="sub-indication"
              type="text"
              placeholder="e.g. Type 2 Diabetes Mellitus"
              value={indication}
              onChange={e => setIndication(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-target-date">
              Target Submit Date
            </label>
            <input
              id="sub-target-date"
              type="date"
              value={targetSubmitDate}
              onChange={e => setTargetSubmitDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-owner-name">
                Owner Name *
              </label>
              <input
                id="sub-owner-name"
                type="text"
                placeholder="e.g. Anika Sharma"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-owner-initials">
                Initials *
              </label>
              <input
                id="sub-owner-initials"
                type="text"
                placeholder="AS"
                maxLength={5}
                value={ownerInitials}
                onChange={e => setOwnerInitials(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} />}
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

