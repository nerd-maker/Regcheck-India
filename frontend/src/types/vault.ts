export type LifecycleState =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'effective'
  | 'rejected'
  | 'superseded'

export interface DocumentListItem {
  id: string
  workspace_id: string
  doc_number: string
  title: string
  doc_type: string
  lifecycle_state: LifecycleState
  current_version: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  page_count: number | null
  owner_name: string
  owner_initials: string
  classification: string
  created_at: string
  updated_at: string
}

export interface DocumentAuditEntry {
  id: string
  document_id: string
  action: string
  from_state: LifecycleState | null
  to_state: LifecycleState | null
  user_name: string
  user_initials: string
  note: string | null
  created_at: string
}

export interface DocumentVersionSchema {
  id: string
  document_id: string
  version_number: string
  storage_path: string
  file_name: string
  file_size_bytes: number
  uploaded_by: string
  upload_note: string | null
  created_at: string
}

export interface ComplianceScanSchema {
  id: string
  document_id: string
  scan_type: string
  status: string
  score: number | null
  findings: unknown[]
  agent_run_id: string | null
  created_at: string
}

export interface DocumentDetail extends DocumentListItem {
  storage_path: string
  storage_bucket: string
  extracted_text: string | null
  versions: DocumentVersionSchema[]
  audit: DocumentAuditEntry[]
  compliance_scans: ComplianceScanSchema[]
}

export interface DocumentListResponse {
  documents: DocumentListItem[]
  total: number
}

export interface UploadDocumentPayload {
  workspace_id: string
  title?: string
  doc_type?: string
  owner_name?: string
  owner_initials?: string
  classification?: string
}
