// src/lib/api.ts
// Single API client — all backend calls go through here.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://regcheck-india.onrender.com"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentResponse {
  result?: string
  output?: string
  analysis?: string
  findings?: string
  answer?: string
  summary?: string
  gaps?: string
  classification?: string
  report?: string
  [key: string]: unknown
}

export interface ExtractTextResponse {
  text: string
  [key: string]: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err}`)
  }
  return res.json()
}

async function postMultipart<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type — browser sets it with boundary automatically
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err}`)
  }
  return res.json()
}

// ── Step 1: Extract text from uploaded file ────────────────────────────────
// Used by all text-based agents (M1–M8 except cross-doc)

export async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  const data = await postMultipart<{ text: string }>(
    "/api/v1/agents/extract-text",
    formData
  )
  return data.text
}

// ── Agent 01: PII Anonymiser ───────────────────────────────────────────────
export async function runAnonymiser(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/anonymise", { document, metadata })
}

// ── Agent 02: Document Summariser ─────────────────────────────────────────
export async function runSummariser(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/summarise", { document, metadata })
}

// ── Agent 03: Completeness Check ──────────────────────────────────────────
export async function runCompletenessCheck(
  document: string,
  document_type?: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/completeness", {
    document,
    document_type: document_type || "GENERAL",
    metadata,
  })
}

// ── Agent 04: Case Classifier ─────────────────────────────────────────────
export async function runCaseClassifier(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/classify", { document, metadata })
}

// ── Agent 05: Inspection Report ───────────────────────────────────────────
export async function runInspectionReport(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/inspection-report", { document, metadata })
}

// ── Agent 06: Regulatory Q&A ──────────────────────────────────────────────
// retrieved_context is the RAG context. For now we pass the question as
// context — full RAG pipeline is a future enhancement.
export async function runRegulatoryQA(
  question: string,
  retrieved_context?: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/qa", {
    question,
    retrieved_context: retrieved_context || question,
    metadata,
  })
}

// ── Agent 07: Schedule Y Check ────────────────────────────────────────────
export async function runScheduleYCheck(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/schedule-y", { document, metadata })
}

// ── Agent 08: ICH E6(R3) GCP ──────────────────────────────────────────────
export async function runICHGCP(
  document: string,
  metadata?: Record<string, unknown>
): Promise<AgentResponse> {
  return post("/api/v1/agents/ich-gcp", { document, metadata })
}

// ── Agent 09: Cross-Document Check ────────────────────────────────────────
// Takes files directly as multipart — no text extraction needed
export async function runCrossDocCheck(
  files: File[]
): Promise<AgentResponse> {
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))
  return postMultipart("/api/v1/agents/cross-document", formData)
}

// ── Health check (use to detect cold start) ───────────────────────────────
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
