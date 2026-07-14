import axios from 'axios';
import type {
  ComplianceScanSchema,
  DocumentDetail,
  DocumentListResponse,
  DocumentListItem,
  LifecycleState as VaultLifecycleState,
  UploadDocumentPayload,
} from '@/types/vault';

// ─── Proxy base ──────────────────────────────────────────────────────────────
// /api/regcheck/* is server-side rewritten by Next.js to the Render backend
// (see next.config.js → rewrites). Same-origin → no CORS, key never exposed
// in the URL/origin.
//
// All endpoints below previously hit `${PROXY_BASE}/<X>` —
// they now hit `/api/regcheck/<X>` and Next.js does the proxying server-side.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';
const PROXY_BASE  = '/api/regcheck';

/** 
 * Obfuscate keys in localStorage to prevent cleartext scraping.
 * Note: This is not encryption, just basic obfuscation.
 */
const obfuscate = (str: string): string => btoa(str);
const deobfuscate = (str: string): string => {
  try {
    return atob(str);
  } catch {
    return str; // Fallback for old cleartext keys
  }
};

/** Read the Anthropic API key from localStorage (safe for SSR).
 *  Defaults to the "admin-regcheck" magic word which tells the backend to
 *  use its own server-side Anthropic key — keeps the demo working without
 *  forcing every user to bring their own key. Users who paste a real key
 *  in Settings will use their own credits.
 */
export const getStoredKey = (): string => {
  if (typeof window === 'undefined') return 'admin-regcheck';
  const val = localStorage.getItem('regcheck_anthropic_key') ?? '';
  const k = deobfuscate(val);
  return k || 'admin-regcheck';  // fallback to demo key
};

/** Returns the raw stored key (or empty string). Use this for UI that shows
 *  "is a personal key set?" — distinct from the default magic word.
 */
export const getRawStoredKey = (): string => {
  if (typeof window === 'undefined') return '';
  const val = localStorage.getItem('regcheck_anthropic_key') ?? '';
  return deobfuscate(val);
};

export const storeKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('regcheck_anthropic_key', obfuscate(key));
  }
};

/** Returns true when the caller has provided a key locally. */
export const isAdminUser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(getStoredKey());
};

export const getSarvamKey = (): string => {
  if (typeof window === 'undefined') return '';
  const val = localStorage.getItem('sarvam_api_key') ?? '';
  return deobfuscate(val);
};

export const storeSarvamKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sarvam_api_key', obfuscate(key));
  }
};


// ─── Generic agent caller — used by M1, M2, M3, M4, M5, M7, M8 ──────────────
export const callAgent = async (
  endpoint: string,
  document: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const response = await axios.post(
      `${PROXY_BASE}${endpoint.replace("/api/v1/agents","")}`,
      { document, metadata },
      { 
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 120000
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Too many requests — please wait a moment and try again.');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out — the server took too long to respond. Please try again.');
      }
      if (error.response?.status === 500) {
        const detail = error.response.data?.detail || 'Internal server error';
        throw new Error(`Server error: ${detail}`);
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid request — please check your input and try again.');
      }
      if (!error.response) {
        throw new Error('Cannot reach the server — it may be starting up. Please wait 30 seconds and try again.');
      }
    }
    throw new Error('An unexpected error occurred. Please try again.');
  }
};

// ─── M6 only — Q&A has different request shape ───────────────────────────────
// retrieved_context is left empty — backend RAG pipeline fills it automatically
export const callQAAgent = async (
  question: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const response = await axios.post(
      `${PROXY_BASE}/qa`,
      { question, retrieved_context: '', metadata },
      { 
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 120000 
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Too many requests — please wait a moment and try again.');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out — the server took too long to respond. Please try again.');
      }
      if (error.response?.status === 500) {
        const detail = error.response.data?.detail || 'Internal server error';
        throw new Error(`Server error: ${detail}`);
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid request — please check your input and try again.');
      }
      if (!error.response) {
        throw new Error('Cannot reach the server — it may be starting up. Please wait 30 seconds and try again.');
      }
    }
    throw new Error('An unexpected error occurred. Please try again.');
  }
};

// ─── Named exports for each module (call callAgent internally) ────────────────
// These replace all old function names. Import these in your components.

export const runPIIAnonymiser = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/anonymise', document, metadata);

export const runDocumentSummariser = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/summarise', document, metadata);

export const runCompletenessAssessor = (document: string, document_type: string = 'GENERAL', metadata = {}) => {
  return axios.post(
    `${PROXY_BASE}/completeness`,
    { document, document_type, metadata },
    {
      headers: {
        'x-anthropic-api-key': getStoredKey(),
      },
      timeout: 120000
    }
  ).then(r => {
    return r.data;
  }).catch((error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error('Too many requests — please wait a moment and try again.');
    }
    throw error;
  });
};

export const runCaseClassifier = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/classify', document, metadata);

export const runInspectionReportGenerator = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/inspection-report', document, metadata);

export const runRegulatoryQA = (question: string, metadata = {}) =>
  callQAAgent(question, metadata);

export const runScheduleYCompliance = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/schedule-y', document, metadata);

export const runICHGCPChecker = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/ich-gcp', document, metadata);

export const extractTextFromFile = async (
  file: File,
): Promise<{
  filename: string;
  extracted_text: string;
  word_count: number;
  pages: number | null;
  status: string;
}> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(
      `${PROXY_BASE}/extract-text`,
      formData,
      {
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error('Unsupported file type. Please upload PDF or DOCX files only.');
      }
      if (error.response?.status === 422) {
        throw new Error('Could not extract text from file. The file may be scanned or image-based.');
      }
      if (!error.response) {
        throw new Error('Cannot reach the server. Please wait 30 seconds and try again.');
      }
    }
    throw new Error('Failed to process file. Please try again.');
  }
};

export const extractTextFromFileOCR = async (
  file: File,
  mode: 'auto' | 'tesseract' | 'vision' = 'auto'
): Promise<{
  extracted_text: string
  filename: string
  word_count: number
  page_count: number
  ocr_method: string
  confidence: number
  warnings: string[]
  status: string
}> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('mode', mode)

  try {
    const response = await axios.post(
      `${PROXY_BASE}/ocr`,
      formData,
      {
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 120000
      }
    )
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('OCR timed out — large files may take up to 2 minutes.')
      }
      if (error.response?.status === 422) {
        throw new Error('Could not extract text — image may be too low quality or blank.')
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Unsupported file type.')
      }
      if (!error.response) {
        throw new Error('Cannot reach server — please wait 30 seconds and try again.')
      }
    }
    throw new Error('OCR failed. Please try again.')
  }
}

export const compareDocuments = async (
  fileA: File,
  fileB: File,
): Promise<any> => {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);

  try {
    const response = await axios.post(
      `${PROXY_BASE}/compare`,
      formData,
      {
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 180000, // 3-minute timeout for heavy document comparison
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out — document comparison is a heavy process. Please try again or use smaller files.');
      }
      if (error.response?.status === 422) {
        throw new Error('Could not extract text from one of the files. They may be scanned or image-based.');
      }
      if (error.response?.status === 401) {
        throw new Error('Anthropic API key is invalid or missing. Please check your Settings.');
      }
      if (error.response?.status === 500) {
        const detail = error.response.data?.detail || 'Internal server error';
        throw new Error(`Comparison failed: ${detail}`);
      }
      if (!error.response) {
        throw new Error('Cannot reach the server. Please wait 30 seconds and try again.');
      }
    }
    throw new Error('Failed to compare documents. Please try again.');
  }
};

export const transcribeMeetingAudio = async (
  file: File,
  languageCode: string = 'unknown'
): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('language_code', languageCode)

  try {
    const response = await axios.post(
      `${PROXY_BASE}/transcribe`,
      formData,
      {
        headers: {
          'x-anthropic-api-key': getStoredKey(),
          'x-sarvam-api-key': getSarvamKey(),
        },
        timeout: 300000  // 5 minutes for long audio files
      }
    )
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Transcription timed out — try a shorter audio file.')
      }
      if (error.response?.status === 401) {
        throw new Error(error.response.data?.detail || 'API key required — add Sarvam key in Settings.')
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Invalid audio file or format.')
      }
      if (!error.response) {
        throw new Error('Cannot reach server — please wait 30 seconds and try again.')
      }
    }
    throw new Error('Transcription failed. Please try again.')
  }
}

// ─── M9 — Cross-Document Consistency Check ────────────────────────────────────
export const crossDocumentCheck = async (files: File[]): Promise<unknown> => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  try {
    const response = await axios.post(
      `${PROXY_BASE}/cross-document`,
      formData,
      {
        headers: {
          'x-anthropic-api-key': getStoredKey(),
        },
        timeout: 300000  // 5 minutes for multi-doc analysis
      }
    )
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Analysis timed out — try with fewer or shorter documents.')
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Invalid request')
      }
      if (error.response?.status === 401) {
        throw new Error('Anthropic API key is invalid or missing. Please check your Settings.')
      }
      if (!error.response) {
        throw new Error('Cannot reach server — please wait 30 seconds and try again.')
      }
    }
    throw new Error('Cross-document analysis failed. Please try again.')
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
export const checkAgentsHealth = () =>
  axios.get(`${PROXY_BASE}/health`).then(r => r.data);

export async function fetchVaultDocuments(
  workspaceId?: string,
  lifecycleState?: VaultLifecycleState | 'review',
): Promise<DocumentListResponse> {
  const params: Record<string, string> = {}
  if (workspaceId) params.workspace_id = workspaceId
  if (lifecycleState) params.lifecycle_state = lifecycleState

  const { data } = await axios.get<DocumentListResponse>(
    `${PROXY_BASE}/vault/documents`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      params,
      timeout: 10000,
    },
  )
  return data
}

export async function fetchVaultDocumentDetail(
  documentId: string,
): Promise<DocumentDetail> {
  const { data } = await axios.get<DocumentDetail>(
    `${PROXY_BASE}/vault/documents/${documentId}`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    },
  )
  return data
}

export async function uploadVaultDocument(
  file: File,
  payload: UploadDocumentPayload,
): Promise<DocumentListItem> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('workspace_id', payload.workspace_id)
  if (payload.title) formData.append('title', payload.title)
  if (payload.doc_type) formData.append('doc_type', payload.doc_type)
  if (payload.owner_name) formData.append('owner_name', payload.owner_name)
  if (payload.owner_initials) formData.append('owner_initials', payload.owner_initials)
  if (payload.classification) formData.append('classification', payload.classification)

  const { data } = await axios.post<DocumentListItem>(
    `${PROXY_BASE}/vault/documents/upload`,
    formData,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 60000,
    },
  )
  return data
}

export async function transitionVaultDocumentState(
  id: string,
  newState: VaultLifecycleState | 'review',
  userName: string,
  userInitials: string,
  reason?: string,
): Promise<DocumentDetail> {
  const { data } = await axios.patch<DocumentDetail>(
    `${PROXY_BASE}/vault/documents/${id}/state`,
    {
      new_state: newState,
      user_name: userName,
      user_initials: userInitials,
      reason,
    },
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    },
  )
  return data
}

export async function fetchVaultDocumentDownloadUrl(
  id: string,
): Promise<{ document_id: string; download_url: string; expires_in: number }> {
  const { data } = await axios.get(
    `${PROXY_BASE}/vault/documents/${id}/download-url`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    },
  )
  return data
}

export async function fetchVaultDocumentScans(
  documentId: string,
): Promise<{ document_id: string; scans: ComplianceScanSchema[]; total: number }> {
  const { data } = await axios.get(
    `${PROXY_BASE}/vault/documents/${documentId}/scans`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    },
  )
  return data
}


export async function exportAgentReportAsWord(
  agentResponse: Record<string, unknown>,
  filename: string
): Promise<void> {
  const res = await fetch('/api/regcheck/export/word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_response: agentResponse,
      filename,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail ?? `Export failed: ${res.status}`)
  }

  // Trigger browser file download
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


// ─── Analytics / Dashboard & Audit (Sprint 4) ───────────────────────────────

export async function fetchDashboardKPIs(): Promise<any> {
  const { data } = await axios.get(
    `${PROXY_BASE}/analytics/dashboard-kpis`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    }
  );
  return data;
}

export async function fetchComplianceByAgent(): Promise<any> {
  const { data } = await axios.get(
    `${PROXY_BASE}/analytics/compliance-by-agent`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    }
  );
  return data;
}

export async function fetchSubmissionThroughput(): Promise<any> {
  const { data } = await axios.get(
    `${PROXY_BASE}/analytics/submission-throughput`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 10000,
    }
  );
  return data;
}

export async function fetchRecentActivity(limit: number = 20): Promise<any> {
  const { data } = await axios.get(
    `${PROXY_BASE}/analytics/recent-activity`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      params: { limit },
      timeout: 10000,
    }
  );
  return data;
}

export async function fetchVaultAuditTrail(workspaceId?: string): Promise<any> {
  const params: Record<string, string> = {};
  if (workspaceId) params.workspace_id = workspaceId;

  const { data } = await axios.get(
    `${PROXY_BASE}/vault/documents/audit-trail`,
    {
      headers: { 'x-anthropic-api-key': getStoredKey() },
      params,
      timeout: 10000,
    }
  );
  return data;
}

export async function fetchSubmissionActivity(submissionId: string): Promise<{
  activities: Array<{
    id: string;
    type: string;
    label: string;
    sublabel: string;
    timestamp: string;
    user_name: string;
    user_initials: string;
  }>;
}> {
  const corrRes = await fetch(
    `/api/regcheck/correspondence?submission_id=${submissionId}`,
    { cache: 'no-store' }
  );
  if (!corrRes.ok) return { activities: [] };
  const corrData = await corrRes.json();
  const corrItems = (corrData.correspondence ?? []) as Record<string, any>[];

  const activities = corrItems.map((c) => ({
    id: `corr-${c.id}`,
    type: 'correspondence',
    label: `HA Correspondence: ${c.subject}`,
    sublabel: `${c.authority} — ${c.number} — ${c.state}`,
    timestamp: c.created_at as string,
    user_name: 'System',
    user_initials: 'HA',
  }));

  try {
    const subRes = await fetch(`/api/regcheck/submissions/${submissionId}`, { cache: 'no-store' });
    if (subRes.ok) {
      const sub = await subRes.json();
      if (sub && sub.updated_at) {
        activities.push({
          id: `sub-update-${submissionId}`,
          type: 'submission',
          label: `Submission Updated: ${sub.name}`,
          sublabel: `State: ${sub.state_label || sub.state}`,
          timestamp: sub.updated_at,
          user_name: sub.owner_name || 'System',
          user_initials: sub.owner_initials || 'AS',
        });
      }
    }
  } catch (e) {
    // Ignore error
  }

  // Sort by timestamp desc
  activities.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return { activities };
}

export async function createApplication(payload: {
  product: string;
  sponsor: string;
  type: string;
  owner_name: string;
  owner_initials: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch('/api/regcheck/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).detail ?? `Create application failed: ${res.status}`);
  }
  return res.json();
}

export async function createRegistration(payload: {
  product: string;
  certificate: string;
  market: string;
  application_id?: string;
  approved_date: string;
  expiry_date: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch('/api/regcheck/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).detail ?? `Create registration failed: ${res.status}`);
  }
  return res.json();
}


// ─── Regulatory Intelligence Feed (Sprint 6) ─────────────────────────────────

export async function fetchRegulatoryUpdates(status = 'pending_review'): Promise<any> {
  const res = await fetch(
    `/api/regcheck/regulatory-updates?status=${status}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return res.json()
}

export async function reviewRegulatoryUpdate(
  id: number,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string
): Promise<any> {
  const res = await fetch(`/api/regcheck/regulatory-updates/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      reviewed_by: reviewedBy,
      rejection_reason: rejectionReason,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as Record<string, string>).detail ?? `Review failed: ${res.status}`
    )
  }
  return res.json()
}

export async function fetchRegulatoryUpdateCounts(): Promise<Record<string, number>> {
  const res = await fetch('/api/regcheck/regulatory-updates/counts', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return res.json()
}

export async function triggerRegulatoryScape(): Promise<any> {
  const res = await fetch('/api/regcheck/regulatory-updates/trigger-scrape', {
    method: 'POST',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Trigger failed: ${res.status}`)
  return res.json()
}
