import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Read the Anthropic API key from localStorage (safe for SSR). */
const getStoredKey = (): string =>
  (typeof window !== 'undefined' ? localStorage.getItem('regcheck_anthropic_key') : null) ?? '';

// ─── Generic agent caller — used by M1, M2, M3, M4, M5, M7, M8 ──────────────
export const callAgent = async (
  endpoint: string,
  document: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}${endpoint}`,
      { document, metadata },
      { 
        headers: { 'x-anthropic-api-key': getStoredKey() },
        timeout: 120000
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
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
      `${BACKEND_URL}/api/v1/agents/qa`,
      { question, retrieved_context: '', metadata },
      { 
        headers: { 'x-anthropic-api-key': getStoredKey() },
        timeout: 120000 
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
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
      `${BACKEND_URL}/api/v1/agents/extract-text`,
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

// ─── Health check ─────────────────────────────────────────────────────────────
export const checkAgentsHealth = () =>
  axios.get(`${BACKEND_URL}/api/v1/agents/health`).then(r => r.data);
