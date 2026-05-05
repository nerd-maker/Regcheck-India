import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

/** Read the Anthropic API key from localStorage (safe for SSR). */
export const getStoredKey = (): string => {
  if (typeof window === 'undefined') return '';
  const val = localStorage.getItem('regcheck_anthropic_key') ?? '';
  return deobfuscate(val);
};

export const storeKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('regcheck_anthropic_key', obfuscate(key));
  }
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
      `${BACKEND_URL}${endpoint}`,
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
      `${BACKEND_URL}/api/v1/agents/qa`,
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
    `${BACKEND_URL}/api/v1/agents/completeness`,
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
      `${BACKEND_URL}/api/v1/agents/ocr`,
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
      `${BACKEND_URL}/api/v1/agents/compare`,
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
      `${BACKEND_URL}/api/v1/agents/transcribe`,
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

// ─── Health check ─────────────────────────────────────────────────────────────
export const checkAgentsHealth = () =>
  axios.get(`${BACKEND_URL}/api/v1/agents/health`).then(r => r.data);
