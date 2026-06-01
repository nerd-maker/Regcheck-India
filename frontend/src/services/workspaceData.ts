// src/services/workspaceData.ts
// The ONLY place the frontend talks to the backend for workspace entity data.
// All views import fetch functions from here — never from mockData directly.
// mockData arrays serve as instant fallback when the backend is unreachable.

import axios from 'axios'
import { getStoredKey } from './api'
import {
  SUBMISSIONS,
  DOCUMENTS,
  APPLICATIONS,
  REGISTRATIONS,
  HA_CORRESPONDENCE,
} from '@/lib/mockData'
import type {
  SubmissionRecord,
  DocumentRecord,
  ApplicationRecord,
  RegistrationRecord,
  HACorrespondenceRecord,
} from '@/lib/mockData'

const PROXY = '/api/regcheck'

const headers = (): Record<string, string> => ({
  'x-anthropic-api-key': getStoredKey(),
})

// ── Shape converters: snake_case backend → camelCase frontend types ──────────

function toSubmission(r: any): SubmissionRecord {
  return {
    id: r.id,
    number: r.number,
    name: r.name,
    type: r.type,
    product: r.product,
    indication: r.indication,
    state: r.state,
    stateLabel: r.state_label ?? undefined,
    haAuthority: r.ha_authority,
    phase: r.phase,
    owner: {
      id: r.owner_id,
      name: r.owner_name,
      initials: r.owner_initials,
      role: r.owner_role,
    },
    targetSubmitDate: r.target_submit_date ?? '',
    riskLevel: r.risk_level,
    documents: r.documents,
    openGaps: r.open_gaps,
    complianceScore: r.compliance_score,
    frameworks: Array.isArray(r.frameworks)
      ? r.frameworks
      : JSON.parse(r.frameworks || '[]'),
    applicationId: r.application_id ?? undefined,
    updatedAt: r.updated_at,
  }
}

function toDocument(r: any): DocumentRecord {
  return {
    id: r.id,
    number: r.number,
    name: r.name,
    type: r.type,
    classification: r.classification,
    state: r.state,
    version: r.version,
    owner: {
      id: r.owner_id,
      name: r.owner_name,
      initials: r.owner_initials,
      role: r.owner_role,
    },
    country: r.country,
    language: r.language,
    size: r.size,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
    submissionId: r.submission_id ?? undefined,
    applicationId: r.application_id ?? undefined,
    complianceScore: r.compliance_score ?? undefined,
    flags: Array.isArray(r.flags)
      ? r.flags
      : JSON.parse(r.flags || '[]'),
    excerpt: r.excerpt ?? undefined,
  }
}

function toApplication(r: any): ApplicationRecord {
  return {
    id: r.id,
    number: r.number,
    product: r.product,
    sponsor: r.sponsor,
    type: r.type,
    status: r.status,
    submissions: r.submissions,
    registrations: r.registrations,
    owner: {
      id: r.owner_id,
      name: r.owner_name,
      initials: r.owner_initials,
      role: r.owner_role,
    },
    openedAt: r.opened_at,
  }
}

function toRegistration(r: any): RegistrationRecord {
  return {
    id: r.id,
    number: r.number,
    product: r.product,
    certificate: r.certificate,
    market: r.market,
    state: r.state,
    approvedDate: r.approved_date,
    expiryDate: r.expiry_date,
    applicationId: r.application_id ?? undefined,
  }
}

function toCorrespondence(r: any): HACorrespondenceRecord {
  return {
    id: r.id,
    number: r.number,
    subject: r.subject,
    direction: r.direction,
    authority: r.authority,
    category: r.category,
    submissionId: r.submission_id ?? undefined,
    receivedAt: r.received_at,
    dueAt: r.due_at ?? undefined,
    state: r.state,
    priority: r.priority,
    preview: r.preview,
  }
}

// ── Fetch functions with mockData fallback ────────────────────────────────────

export async function fetchSubmissions(): Promise<SubmissionRecord[]> {
  try {
    const { data } = await axios.get(`${PROXY}/submissions`, {
      headers: headers(),
      timeout: 8000,
    })
    return (data as any[]).map(toSubmission)
  } catch {
    return SUBMISSIONS // instant fallback — no visible loading failure
  }
}

export async function fetchDocuments(
  submissionId?: string,
): Promise<DocumentRecord[]> {
  try {
    const params = submissionId ? { submission_id: submissionId } : {}
    const { data } = await axios.get(`${PROXY}/documents`, {
      headers: headers(),
      params,
      timeout: 8000,
    })
    return (data as any[]).map(toDocument)
  } catch {
    return submissionId
      ? DOCUMENTS.filter((d) => d.submissionId === submissionId)
      : DOCUMENTS
  }
}

export async function fetchApplications(): Promise<ApplicationRecord[]> {
  try {
    const { data } = await axios.get(`${PROXY}/applications`, {
      headers: headers(),
      timeout: 8000,
    })
    return (data as any[]).map(toApplication)
  } catch {
    return APPLICATIONS
  }
}

export async function fetchRegistrations(): Promise<RegistrationRecord[]> {
  try {
    const { data } = await axios.get(`${PROXY}/registrations`, {
      headers: headers(),
      timeout: 8000,
    })
    return (data as any[]).map(toRegistration)
  } catch {
    return REGISTRATIONS
  }
}

export async function fetchCorrespondence(
  submissionId?: string,
): Promise<HACorrespondenceRecord[]> {
  try {
    const params = submissionId ? { submission_id: submissionId } : {}
    const { data } = await axios.get(`${PROXY}/correspondence`, {
      headers: headers(),
      params,
      timeout: 8000,
    })
    return (data as any[]).map(toCorrespondence)
  } catch {
    return submissionId
      ? HA_CORRESPONDENCE.filter((h) => h.submissionId === submissionId)
      : HA_CORRESPONDENCE
  }
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createSubmission(body: {
  name: string
  type: string
  product: string
  indication: string
  phase: string
  ha_authority?: string
  target_submit_date?: string
  risk_level?: string
  frameworks?: string[]
}): Promise<SubmissionRecord> {
  const { data } = await axios.post(`${PROXY}/submissions`, body, {
    headers: headers(),
    timeout: 10000,
  })
  return toSubmission(data)
}

export async function uploadDocument(
  file: File,
  submissionId?: string,
  documentType?: string,
  classification?: string,
): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)
  const params: Record<string, string> = {}
  if (submissionId) params.submission_id = submissionId
  if (documentType) params.document_type = documentType
  if (classification) params.classification = classification

  const { data } = await axios.post(
    `${PROXY}/documents/upload`,
    formData,
    {
      headers: headers(),
      params,
      timeout: 30000,
    },
  )
  return toDocument(data)
}

export async function updateCorrespondenceState(
  id: string,
  state: string,
): Promise<HACorrespondenceRecord> {
  const { data } = await axios.patch(
    `${PROXY}/correspondence/${id}`,
    { state },
    { headers: headers(), timeout: 8000 },
  )
  return toCorrespondence(data)
}
