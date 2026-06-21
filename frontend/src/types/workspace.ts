export type LifecycleState =
  | 'draft' | 'review' | 'approved' | 'effective' | 'rejected' | 'superseded'

export type SubmissionType =
  | 'IND' | 'NDA' | 'CT-04' | 'Schedule M' | 'Pre-IND Meeting' | 'Annual Update'

export interface Person {
  id: string
  name: string
  initials: string
  role: string
}

export interface AuditEvent {
  id: string
  ts: string
  user: string
  initials: string
  action: string
  target: string
  meta?: string
}

export interface DocumentRecord {
  id: string
  number: string                   // e.g. DOC-0042
  name: string
  type: 'Protocol' | 'ICF' | 'IB' | 'CSR' | 'SAE Narrative' | 'CTRI' | 'CT-04' | 'Cover Letter' | 'Inspection Report'
  classification: string           // e.g. "Clinical / Protocol"
  state: LifecycleState
  version: string                  // e.g. "0.4 (Draft)"
  owner: Person
  country: 'India'
  language: string
  size: string                     // "248 KB"
  updatedAt: string                // "2 hours ago"
  updatedBy: string
  submissionId?: string
  applicationId?: string
  complianceScore?: number         // 0-100
  flags?: ('pii-detected' | 'expedited' | 'critical-gap' | 'pending-signoff')[]
  excerpt?: string                 // representative content snippet (used by AI agents)
}

export interface SubmissionRecord {
  id: string
  number: string                   // RC-SUB-2025-0042
  name: string
  type: SubmissionType
  product: string
  indication: string
  state: LifecycleState
  stateLabel?: string              // override label
  haAuthority: 'CDSCO' | 'CDSCO + State FDA' | 'CDSCO + DCGI'
  phase: 'Pre-IND' | 'Phase I' | 'Phase II' | 'Phase III' | 'Post-Marketing'
  owner: Person
  targetSubmitDate: string
  riskLevel: 'low' | 'medium' | 'high'
  documents: number
  openGaps: number
  complianceScore: number          // 0-100
  frameworks: string[]
  applicationId?: string
  updatedAt: string
}

export interface ApplicationRecord {
  id: string
  number: string                   // RC-APP-2025-014
  product: string
  sponsor: string
  type: 'Clinical Trial' | 'New Drug' | 'Subsequent New Drug'
  status: 'Active' | 'Pending CDSCO' | 'Approved' | 'On Hold'
  submissions: number
  registrations: number
  owner: Person
  openedAt: string
}

export interface RegistrationRecord {
  id: string
  number: string
  product: string
  certificate: string
  market: 'India'
  state: 'Effective' | 'Expiring Soon' | 'Expired' | 'Withdrawn'
  approvedDate: string
  expiryDate: string
  applicationId?: string
}

export interface HACorrespondenceRecord {
  id: string
  number: string                   // CDSCO-Q-2025-0089
  subject: string
  direction: 'inbound' | 'outbound'
  authority: 'CDSCO' | 'DCGI'
  category: 'Deficiency Letter' | 'Query' | 'Approval' | 'Acknowledgement' | 'CAPA Request'
  submissionId?: string
  receivedAt: string
  dueAt?: string
  state: 'open' | 'response-drafted' | 'closed'
  priority: 'standard' | 'high' | 'critical'
  preview: string
}

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  draft:      'Draft',
  review:     'In Review',
  approved:   'Approved',
  effective:  'Effective',
  rejected:   'Deficiency Issued',
  superseded: 'Superseded',
}
