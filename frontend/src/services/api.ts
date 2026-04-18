import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Generic agent caller — used by M1, M2, M3, M4, M5, M7, M8 ──────────────
export const callAgent = async (
  endpoint: string,
  document: string,
  metadata: Record<string, unknown> = {}
) => {
  const response = await axios.post(`${BACKEND_URL}${endpoint}`, {
    document,
    metadata,
  });
  return response.data;
};

// ─── M6 only — Q&A has different request shape ───────────────────────────────
// retrieved_context is left empty — backend RAG pipeline fills it automatically
export const callQAAgent = async (
  question: string,
  metadata: Record<string, unknown> = {}
) => {
  const response = await axios.post(`${BACKEND_URL}/api/v1/agents/qa`, {
    question,
    retrieved_context: '',
    metadata,
  });
  return response.data;
};

// ─── Named exports for each module (call callAgent internally) ────────────────
// These replace all old function names. Import these in your components.

export const runPIIAnonymiser = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/anonymise', document, metadata);

export const runDocumentSummariser = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/summarise', document, metadata);

export const runCompletenessAssessor = (document: string, metadata = {}) =>
  callAgent('/api/v1/agents/completeness', document, metadata);

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

// ─── Health check ─────────────────────────────────────────────────────────────
export const checkAgentsHealth = () =>
  axios.get(`${BACKEND_URL}/api/v1/agents/health`).then(r => r.data);
