/*
 * SETUP REQUIRED — Formspree
 * 1. Go to https://formspree.io and sign up with contact@regcheck.in
 * 2. Create a new form named "RegCheck-India Demo Requests"
 * 3. Copy the form ID (looks like: xpzgkwqr)
 * 4. Replace REPLACE_WITH_FORMSPREE_ID in the fetch URL below with your form ID
 * 5. Formspree free tier: 50 submissions/month. Upgrade if needed.
 * Submissions will arrive at contact@regcheck.in inbox automatically.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface FormData {
  name: string
  contact: string
  organisation: string
  role: string
  email: string
}

interface FormErrors {
  name?: string
  contact?: string
  organisation?: string
  role?: string
  email?: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

const ROLES = [
  'Regulatory Affairs Manager',
  'RA Consultant',
  'Clinical Research Associate',
  'Medical Affairs',
  'CRO Operations',
  'Pharmacovigilance',
  'Other',
]

const EMPTY: FormData = { name: '', contact: '', organisation: '', role: '', email: '' }

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {}
  if (!data.name.trim()) errors.name = 'Full name is required.'
  if (!data.contact.trim()) {
    errors.contact = 'Contact number is required.'
  } else {
    const digits = data.contact.replace(/[\s\-\+]/g, '')
    if (!/^\d{10}$/.test(digits)) errors.contact = 'Please enter a valid 10-digit mobile number.'
  }
  if (!data.organisation.trim()) errors.organisation = 'Organisation name is required.'
  if (!data.role) errors.role = 'Please select your role.'
  if (!data.email.trim()) {
    errors.email = 'Email address is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address.'
  }
  return errors
}

export default function DemoRequestModal({ isOpen, onClose }: Props) {
  const [formData, setFormData] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState('')
  const [visible, setVisible] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animation: open delay
  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      setTimeout(() => firstInputRef.current?.focus(), 150)
    } else {
      setVisible(false)
      setStatus('idle')
      setFormData(EMPTY)
      setErrors({})
      setServerError('')
    }
  }, [isOpen])

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Auto-close after success
  useEffect(() => {
    if (status === 'success') {
      closeTimerRef.current = setTimeout(() => onClose(), 4000)
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }
  }, [status, onClose])

  // Focus trap
  const trapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const focusableSelector = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const trap = trapRef.current
    if (!trap) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(trap.querySelectorAll<HTMLElement>(focusableSelector))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    trap.addEventListener('keydown', handleTab)
    return () => trap.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(formData)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setStatus('submitting')
    setServerError('')

    const payload = {
      name: formData.name,
      contact: formData.contact,
      organisation: formData.organisation,
      role: formData.role,
      email: formData.email,
      source: 'RegCheck-India Landing Page',
      submitted_at: new Date().toISOString(),
    }

    try {
      const res = await fetch('https://formspree.io/f/REPLACE_WITH_FORMSPREE_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        throw new Error(`Server responded ${res.status}`)
      }
    } catch {
      setStatus('error')
      setServerError('Submission failed. Please email us at contact@regcheck.in')
    }
  }

  const inputClass = (field: keyof FormErrors) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${
      errors[field] ? 'border-red-400' : 'border-gray-200'
    }`

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-16"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="Request a Pilot Demo"
    >
      <div
        ref={trapRef}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        style={{
          transition: 'opacity 150ms ease, transform 150ms ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
        >
          ✕
        </button>

        <div className="p-8">
          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Request received.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                We&apos;ll be in touch within 24 hours.
              </p>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
              >
                In the meantime, explore the vault →
              </Link>
              <p className="text-xs text-gray-400 mt-6">This dialog closes automatically in a few seconds.</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Request a Pilot Demo</h2>
                <p className="text-sm text-gray-500 mt-1">
                  30-min walkthrough with our founding team. No commitment.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="demo-name">
                    Full Name *
                  </label>
                  <input
                    ref={firstInputRef}
                    id="demo-name"
                    type="text"
                    placeholder="Dr. Anjali Shah"
                    value={formData.name}
                    onChange={set('name')}
                    className={inputClass('name')}
                    autoComplete="name"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="demo-contact">
                    Contact Number *
                  </label>
                  <input
                    id="demo-contact"
                    type="tel"
                    placeholder="+91 98XXX XXXXX"
                    value={formData.contact}
                    onChange={set('contact')}
                    className={inputClass('contact')}
                    autoComplete="tel"
                  />
                  {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
                </div>

                {/* Organisation */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="demo-org">
                    Organisation Name *
                  </label>
                  <input
                    id="demo-org"
                    type="text"
                    placeholder="Cipla Ltd / XYZ CRO"
                    value={formData.organisation}
                    onChange={set('organisation')}
                    className={inputClass('organisation')}
                    autoComplete="organization"
                  />
                  {errors.organisation && <p className="text-red-500 text-xs mt-1">{errors.organisation}</p>}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="demo-role">
                    Role *
                  </label>
                  <select
                    id="demo-role"
                    value={formData.role}
                    onChange={set('role')}
                    className={`${inputClass('role')} appearance-none`}
                  >
                    <option value="">Select your role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="demo-email">
                    Email ID *
                  </label>
                  <input
                    id="demo-email"
                    type="email"
                    placeholder="you@organisation.com"
                    value={formData.email}
                    onChange={set('email')}
                    className={inputClass('email')}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                {serverError && (
                  <p className="text-red-500 text-xs mt-1">{serverError}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {status === 'submitting' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending…
                    </>
                  ) : 'Send Request'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
