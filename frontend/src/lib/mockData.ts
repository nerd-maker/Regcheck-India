// ─────────────────────────────────────────────────────────────────────────────
// RegCheck-India — Enterprise mock fixtures
// Used while frontend is being rewired ahead of backend wiring.
// ─────────────────────────────────────────────────────────────────────────────

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

// ── People ───────────────────────────────────────────────────────────────────
export const PEOPLE: Record<string, Person> = {
  ra:   { id: 'p1', name: 'Anika Sharma',     initials: 'AS', role: 'Regulatory Lead' },
  cmc:  { id: 'p2', name: 'Rajat Iyer',       initials: 'RI', role: 'CMC Lead' },
  clin: { id: 'p3', name: 'Dr. Priya Menon',  initials: 'PM', role: 'Clinical Lead' },
  pv:   { id: 'p4', name: 'Karan Bhatt',      initials: 'KB', role: 'Pharmacovigilance' },
  qa:   { id: 'p5', name: 'Meera Nair',       initials: 'MN', role: 'Quality Assurance' },
  reg:  { id: 'p6', name: 'Vikram Joshi',     initials: 'VJ', role: 'RA Specialist' },
}

// ── Submissions ──────────────────────────────────────────────────────────────
export const SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 's-001',
    number: 'RC-SUB-2025-0042',
    name: 'ZP-101 — IND Application',
    type: 'IND',
    product: 'ZP-101',
    indication: 'Type 2 Diabetes Mellitus',
    state: 'review',
    stateLabel: 'In CDSCO Review',
    haAuthority: 'CDSCO',
    phase: 'Phase II',
    owner: PEOPLE.ra,
    targetSubmitDate: '2025-12-15',
    riskLevel: 'medium',
    documents: 18,
    openGaps: 4,
    complianceScore: 72,
    frameworks: ['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)'],
    applicationId: 'a-001',
    updatedAt: '12 minutes ago',
  },
  {
    id: 's-002',
    number: 'RC-SUB-2025-0089',
    name: 'BX-400 — SAE Expedited Report',
    type: 'CT-04',
    product: 'BX-400',
    indication: 'Complicated Urinary Tract Infection',
    state: 'rejected',
    stateLabel: 'Deficiency Issued',
    haAuthority: 'CDSCO',
    phase: 'Phase III',
    owner: PEOPLE.pv,
    targetSubmitDate: '2025-10-30',
    riskLevel: 'high',
    documents: 6,
    openGaps: 7,
    complianceScore: 48,
    frameworks: ['NDCTR 2019', 'ICH E2A'],
    applicationId: 'a-002',
    updatedAt: '1 hour ago',
  },
  {
    id: 's-003',
    number: 'RC-SUB-2025-0117',
    name: 'BX-500 — Pre-IND Briefing',
    type: 'Pre-IND Meeting',
    product: 'BX-500',
    indication: 'JAK Inhibitor — Rheumatoid Arthritis',
    state: 'approved',
    stateLabel: 'Ready for Submission',
    haAuthority: 'CDSCO',
    phase: 'Phase I',
    owner: PEOPLE.clin,
    targetSubmitDate: '2025-11-22',
    riskLevel: 'low',
    documents: 9,
    openGaps: 0,
    complianceScore: 94,
    frameworks: ['Schedule Y', 'ICH E6(R3)'],
    applicationId: 'a-003',
    updatedAt: '3 hours ago',
  },
  {
    id: 's-004',
    number: 'RC-SUB-2025-0091',
    name: 'AX-220 Annual Update',
    type: 'Annual Update',
    product: 'AX-220',
    indication: 'Hypertension',
    state: 'draft',
    haAuthority: 'CDSCO',
    phase: 'Post-Marketing',
    owner: PEOPLE.reg,
    targetSubmitDate: '2026-01-10',
    riskLevel: 'low',
    documents: 4,
    openGaps: 2,
    complianceScore: 81,
    frameworks: ['NDCTR 2019'],
    applicationId: 'a-004',
    updatedAt: 'yesterday',
  },
  {
    id: 's-005',
    number: 'RC-SUB-2025-0073',
    name: 'CX-310 — NDA Filing',
    type: 'NDA',
    product: 'CX-310',
    indication: 'Acute Myeloid Leukaemia (AML)',
    state: 'effective',
    stateLabel: 'Submitted',
    haAuthority: 'CDSCO + DCGI',
    phase: 'Post-Marketing',
    owner: PEOPLE.ra,
    targetSubmitDate: '2025-09-04',
    riskLevel: 'high',
    documents: 27,
    openGaps: 1,
    complianceScore: 88,
    frameworks: ['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A'],
    applicationId: 'a-005',
    updatedAt: '2 days ago',
  },
  {
    id: 's-006',
    number: 'RC-SUB-2025-0124',
    name: 'DM-700 Schedule M Inspection',
    type: 'Schedule M',
    product: 'DM-700',
    indication: 'Manufacturing facility — Vadodara',
    state: 'review',
    stateLabel: 'In QA Review',
    haAuthority: 'CDSCO + State FDA',
    phase: 'Post-Marketing',
    owner: PEOPLE.qa,
    targetSubmitDate: '2025-12-01',
    riskLevel: 'medium',
    documents: 12,
    openGaps: 3,
    complianceScore: 79,
    frameworks: ['Schedule M', 'CDSCO GMP'],
    applicationId: 'a-006',
    updatedAt: '5 hours ago',
  },
]

// ── Documents (lots of them — submission s-001 has most) ─────────────────────
export const DOCUMENTS: DocumentRecord[] = [
  {
    id: 'd-001', number: 'DOC-0042', name: 'ZP-101 Phase II Protocol v2.1',
    type: 'Protocol', classification: 'Clinical / Protocol',
    state: 'review', version: '2.1 (In Review)',
    owner: PEOPLE.clin, country: 'India', language: 'en',
    size: '1.8 MB', updatedAt: '14 min ago', updatedBy: PEOPLE.clin.name,
    submissionId: 's-001', applicationId: 'a-001',
    complianceScore: 72,
    flags: ['critical-gap'],
  },
  {
    id: 'd-002', number: 'DOC-0043', name: 'ZP-101 Informed Consent Form (English)',
    type: 'ICF', classification: 'Clinical / Consent',
    state: 'review', version: '1.4',
    owner: PEOPLE.clin, country: 'India', language: 'en',
    size: '342 KB', updatedAt: '1 hour ago', updatedBy: PEOPLE.clin.name,
    submissionId: 's-001', applicationId: 'a-001',
    complianceScore: 88,
  },
  {
    id: 'd-003', number: 'DOC-0044', name: 'ZP-101 Investigator Brochure',
    type: 'IB', classification: 'Clinical / IB',
    state: 'approved', version: '3.0',
    owner: PEOPLE.cmc, country: 'India', language: 'en',
    size: '4.2 MB', updatedAt: 'yesterday', updatedBy: PEOPLE.cmc.name,
    submissionId: 's-001', applicationId: 'a-001',
    complianceScore: 95,
  },
  {
    id: 'd-004', number: 'DOC-0045', name: 'ZP-101 CMC Data Package — Stability',
    type: 'CSR', classification: 'CMC / Stability',
    state: 'draft', version: '0.3',
    owner: PEOPLE.cmc, country: 'India', language: 'en',
    size: '6.1 MB', updatedAt: '2 days ago', updatedBy: PEOPLE.cmc.name,
    submissionId: 's-001',
    complianceScore: 56, flags: ['critical-gap', 'pending-signoff'],
  },
  {
    id: 'd-005', number: 'DOC-0046', name: 'ZP-101 Cover Letter — CDSCO Form 44',
    type: 'Cover Letter', classification: 'Regulatory / Submission',
    state: 'draft', version: '0.2',
    owner: PEOPLE.reg, country: 'India', language: 'en',
    size: '128 KB', updatedAt: '3 hours ago', updatedBy: PEOPLE.reg.name,
    submissionId: 's-001',
    complianceScore: 64,
  },
  {
    id: 'd-006', number: 'DOC-0047', name: 'ZP-101 CTRI Registration Form',
    type: 'CTRI', classification: 'Clinical / Registration',
    state: 'effective', version: '1.0',
    owner: PEOPLE.reg, country: 'India', language: 'en',
    size: '267 KB', updatedAt: '4 days ago', updatedBy: PEOPLE.reg.name,
    submissionId: 's-001',
    complianceScore: 100,
  },
  {
    id: 'd-007', number: 'DOC-0048', name: 'ZP-101 Risk Mitigation Plan',
    type: 'Protocol', classification: 'Clinical / Risk Management',
    state: 'review', version: '1.1',
    owner: PEOPLE.qa, country: 'India', language: 'en',
    size: '512 KB', updatedAt: '1 day ago', updatedBy: PEOPLE.qa.name,
    submissionId: 's-001',
    complianceScore: 70, flags: ['pii-detected'],
  },
  {
    id: 'd-008', number: 'DOC-0089', name: 'BX-400 SAE CT-04 Narrative',
    type: 'SAE Narrative', classification: 'Pharmacovigilance / SAE',
    state: 'review', version: '0.5',
    owner: PEOPLE.pv, country: 'India', language: 'en',
    size: '256 KB', updatedAt: '2 hours ago', updatedBy: PEOPLE.pv.name,
    submissionId: 's-002',
    complianceScore: 51, flags: ['critical-gap', 'expedited'],
  },
  {
    id: 'd-009', number: 'DOC-0090', name: 'BX-400 Causality Assessment',
    type: 'SAE Narrative', classification: 'Pharmacovigilance / SAE',
    state: 'draft', version: '0.2',
    owner: PEOPLE.pv, country: 'India', language: 'en',
    size: '198 KB', updatedAt: '2 hours ago', updatedBy: PEOPLE.pv.name,
    submissionId: 's-002',
    complianceScore: 44,
  },
  {
    id: 'd-010', number: 'DOC-0117', name: 'BX-500 Pre-IND Briefing Document',
    type: 'Protocol', classification: 'Regulatory / Pre-IND',
    state: 'approved', version: '1.0',
    owner: PEOPLE.clin, country: 'India', language: 'en',
    size: '2.4 MB', updatedAt: '3 hours ago', updatedBy: PEOPLE.clin.name,
    submissionId: 's-003',
    complianceScore: 96,
  },
  {
    id: 'd-011', number: 'DOC-0124', name: 'DM-700 Schedule M Inspection Report',
    type: 'Inspection Report', classification: 'GMP / Inspection',
    state: 'review', version: '1.0',
    owner: PEOPLE.qa, country: 'India', language: 'en',
    size: '3.6 MB', updatedAt: '5 hours ago', updatedBy: PEOPLE.qa.name,
    submissionId: 's-006',
    complianceScore: 79,
  },
]

// ── Applications ─────────────────────────────────────────────────────────────
export const APPLICATIONS: ApplicationRecord[] = [
  { id: 'a-001', number: 'RC-APP-2025-014', product: 'ZP-101', sponsor: 'Zephyr Pharma Pvt Ltd',
    type: 'Clinical Trial', status: 'Pending CDSCO',
    submissions: 3, registrations: 0, owner: PEOPLE.ra, openedAt: '2025-08-12' },
  { id: 'a-002', number: 'RC-APP-2025-022', product: 'BX-400', sponsor: 'Beacon Therapeutics',
    type: 'Clinical Trial', status: 'On Hold',
    submissions: 2, registrations: 0, owner: PEOPLE.pv, openedAt: '2025-09-03' },
  { id: 'a-003', number: 'RC-APP-2025-031', product: 'BX-500', sponsor: 'Beacon Therapeutics',
    type: 'Clinical Trial', status: 'Active',
    submissions: 1, registrations: 0, owner: PEOPLE.clin, openedAt: '2025-10-18' },
  { id: 'a-004', number: 'RC-APP-2024-088', product: 'AX-220', sponsor: 'Apex Biosciences',
    type: 'Subsequent New Drug', status: 'Active',
    submissions: 4, registrations: 1, owner: PEOPLE.reg, openedAt: '2024-04-22' },
  { id: 'a-005', number: 'RC-APP-2024-104', product: 'CX-310', sponsor: 'Cyrus Oncology',
    type: 'New Drug', status: 'Approved',
    submissions: 2, registrations: 1, owner: PEOPLE.ra, openedAt: '2024-07-15' },
  { id: 'a-006', number: 'RC-APP-2025-049', product: 'DM-700', sponsor: 'Demeter Labs',
    type: 'Subsequent New Drug', status: 'Active',
    submissions: 2, registrations: 1, owner: PEOPLE.qa, openedAt: '2025-06-30' },
]

// ── Registrations ────────────────────────────────────────────────────────────
export const REGISTRATIONS: RegistrationRecord[] = [
  { id: 'r-001', number: 'CT-NOC-2024/AX-220', product: 'AX-220', certificate: 'Form CT-23',
    market: 'India', state: 'Effective', approvedDate: '2024-08-14', expiryDate: '2027-08-13', applicationId: 'a-004' },
  { id: 'r-002', number: 'IN-NDA-2024/CX-310', product: 'CX-310', certificate: 'Form 46',
    market: 'India', state: 'Effective', approvedDate: '2024-12-02', expiryDate: '2029-12-01', applicationId: 'a-005' },
  { id: 'r-003', number: 'CT-NOC-2022/DM-700-MFG', product: 'DM-700', certificate: 'Schedule M License',
    market: 'India', state: 'Expiring Soon', approvedDate: '2022-03-18', expiryDate: '2026-03-17', applicationId: 'a-006' },
]

// ── HA Correspondence ────────────────────────────────────────────────────────
export const HA_CORRESPONDENCE: HACorrespondenceRecord[] = [
  { id: 'h-001', number: 'CDSCO-Q-2025-0089',
    subject: 'Deficiency Letter — BX-400 CT-04 SAE Narrative',
    direction: 'inbound', authority: 'CDSCO', category: 'Deficiency Letter',
    submissionId: 's-002', receivedAt: '2025-10-21', dueAt: '2025-10-28',
    state: 'open', priority: 'critical',
    preview: 'CDSCO has issued a deficiency notice regarding inadequate causality assessment in the CT-04 narrative for case CASE-2025-0089...' },
  { id: 'h-002', number: 'CDSCO-Q-2025-0091',
    subject: 'Query — ZP-101 Protocol v2 Dose Justification',
    direction: 'inbound', authority: 'CDSCO', category: 'Query',
    submissionId: 's-001', receivedAt: '2025-10-19', dueAt: '2025-11-02',
    state: 'response-drafted', priority: 'high',
    preview: 'Justify the choice of 400 mg starting dose for ZP-101 in light of the Phase I PK/PD profile...' },
  { id: 'h-003', number: 'CDSCO-AK-2025-0084',
    subject: 'Acknowledgement — CX-310 NDA Submission',
    direction: 'inbound', authority: 'CDSCO', category: 'Acknowledgement',
    submissionId: 's-005', receivedAt: '2025-09-08', state: 'closed', priority: 'standard',
    preview: 'CDSCO acknowledges receipt of NDA submission for CX-310 (RC-SUB-2025-0073)...' },
  { id: 'h-004', number: 'CDSCO-AP-2025-0072',
    subject: 'Approval — CX-310 New Drug Approval',
    direction: 'inbound', authority: 'DCGI', category: 'Approval',
    submissionId: 's-005', receivedAt: '2025-09-19', state: 'closed', priority: 'standard',
    preview: 'Approval letter granted for CX-310 (Acute Myeloid Leukaemia) per NDCTR 2019 Rule 80...' },
]

// ── Audit Trail ──────────────────────────────────────────────────────────────
export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'e1', ts: '2025-10-22 14:48',  user: PEOPLE.clin.name, initials: PEOPLE.clin.initials,
    action: 'AI Compliance Action: Cross-document consistency check',
    target: 'RC-SUB-2025-0042 / 4 documents',
    meta: 'Flagged dose mismatch — Protocol v2.1 says 400 mg but ICF v1.4 shows 200 mg' },
  { id: 'e2', ts: '2025-10-22 13:24',  user: PEOPLE.qa.name, initials: PEOPLE.qa.initials,
    action: 'Document state change',
    target: 'DOC-0048 Risk Mitigation Plan',
    meta: 'Draft → In Review' },
  { id: 'e3', ts: '2025-10-22 12:11',  user: PEOPLE.ra.name, initials: PEOPLE.ra.initials,
    action: 'AI Compliance Action: Schedule Y deep check',
    target: 'RC-SUB-2025-0042 / DOC-0042',
    meta: '3 critical gaps resolved · 2 major gaps remain' },
  { id: 'e4', ts: '2025-10-22 10:09',  user: PEOPLE.pv.name, initials: PEOPLE.pv.initials,
    action: 'AI Compliance Action: SAE Case Classification',
    target: 'DOC-0089 BX-400 CT-04 Narrative',
    meta: 'Classified as anaphylaxis (Grade IV). Expedited reporting required within 7 days.' },
  { id: 'e5', ts: '2025-10-22 09:33',  user: PEOPLE.clin.name, initials: PEOPLE.clin.initials,
    action: 'AI Compliance Action: PII Anonymisation',
    target: 'DOC-0042 ZP-101 Protocol v2.1',
    meta: '8 PII entities removed (per DPDP Act 2023)' },
  { id: 'e6', ts: '2025-10-21 17:02',  user: PEOPLE.reg.name, initials: PEOPLE.reg.initials,
    action: 'Submission state change',
    target: 'RC-SUB-2025-0089',
    meta: 'In Review → Deficiency Issued (CDSCO-Q-2025-0089)' },
  { id: 'e7', ts: '2025-10-21 11:48',  user: 'system', initials: 'SY',
    action: 'HA Correspondence received',
    target: 'CDSCO-Q-2025-0089',
    meta: 'Deficiency letter linked to RC-SUB-2025-0089' },
  { id: 'e8', ts: '2025-10-20 16:21',  user: PEOPLE.cmc.name, initials: PEOPLE.cmc.initials,
    action: 'Document uploaded',
    target: 'DOC-0044 ZP-101 Investigator Brochure',
    meta: 'v3.0 · 4.2 MB' },
]

// ── Lifecycle states (config) ────────────────────────────────────────────────
export const SUBMISSION_LIFECYCLE: { id: LifecycleState; label: string }[] = [
  { id: 'draft',     label: 'Draft' },
  { id: 'review',    label: 'In Review' },
  { id: 'approved',  label: 'Approved' },
  { id: 'effective', label: 'Submitted' },
]

// ── KPI snapshots for Home ───────────────────────────────────────────────────
export const HOME_KPIS = [
  { label: 'Active Submissions',  value: 12,  delta: '+2',  trend: 'up'   as const, sub: 'vs last week'   },
  { label: 'Open Critical Gaps',  value: 7,   delta: '-3',  trend: 'down' as const, sub: 'this sprint'    },
  { label: 'AI Actions Run',      value: 218, delta: '+34', trend: 'up'   as const, sub: 'last 30 days'   },
  { label: 'HA Items Past Due',   value: 1,   delta: '+1',  trend: 'up'   as const, sub: 'requires action'},
]

// ── Compliance breakdown for Home ────────────────────────────────────────────
export const COMPLIANCE_SCORES = [
  { name: 'Schedule Y',            score: 71, color: '#B45309' },
  { name: 'ICH E6(R3) GCP',        score: 84, color: '#15803D' },
  { name: 'NDCTR 2019',            score: 68, color: '#B45309' },
  { name: 'Completeness',          score: 89, color: '#15803D' },
  { name: 'Cross-doc consistency', score: 52, color: '#B91C1C' },
  { name: 'DPDP Act 2023 / PII',   score: 100,color: '#15803D' },
]

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  draft:      'Draft',
  review:     'In Review',
  approved:   'Approved',
  effective:  'Effective',
  rejected:   'Deficiency Issued',
  superseded: 'Superseded',
}
