/**
 * API client for RegCheck-India backend
 */
import axios from 'axios';
import { getSessionId } from '../utils/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export type AgentEnvelope<T = Record<string, unknown>> = {
    agent: string;
    model: string;
    result: T;
    timestamp: string;
    token_usage: {
        input_tokens: number;
        output_tokens: number;
    };
};

const unwrapAgentResult = <T extends Record<string, unknown>>(payload: AgentEnvelope<T>) => ({
    ...payload.result,
    model_attribution: {
        primary_model: payload.model,
        provider: 'Anthropic Claude',
        sovereign: false,
    },
    agent: payload.agent,
    timestamp: payload.timestamp,
    token_usage: payload.token_usage,
});

// Inject X-Session-ID header on every request
apiClient.interceptors.request.use((config) => {
    config.headers['X-Session-ID'] = getSessionId();
    return config;
});

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface DocumentMetadata {
    document_type: string;
    sponsor_name: string;
    drug_name: string;
    inn?: string;
    trial_phase: string;
    submission_target: string;
    version?: string;
    date?: string;
}

export interface UploadResponse {
    file_id: string;
    filename: string;
    file_size: number;
    upload_timestamp: string;
}

export interface Finding {
    finding_id: string;
    section: string;
    requirement: string;
    citation: string;
    current_text?: string;
    status: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT APPLICABLE' | 'UNVERIFIED';
    gap?: string;
    recommended_language?: string;
    human_review_required: boolean;
    human_review_reason?: string;
}

export interface EvaluationResponse {
    evaluation_id: string;
    document_type: string;
    overall_status: 'PASS' | 'PARTIAL' | 'FAIL';
    overall_risk: 'HIGH' | 'MEDIUM' | 'LOW';
    total_findings: number;
    findings_by_status: {
        FAIL: number;
        PARTIAL: number;
        PASS: number;
        UNVERIFIED: number;
    };
    findings: Finding[];
    critical_blockers: string[];
    missing_sections: string[];
    evaluator_notes?: string;
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
    confidence_rationale: string;
    timestamp: string;
    model_attribution?: {
        primary_model?: string;
        validator_model?: string;
        ner_model?: string;
        provider?: string;
        sovereign?: boolean;
    };
}

export interface GeneratedSection {
    section_number: string;
    section_heading: string;
    generated_content: string;
    placeholders_used: string[];
    regulatory_choices_made: Record<string, string>[];
    completion_pct: number;
    review_priority: 'HIGH' | 'MEDIUM' | 'LOW';
    review_priority_reason: string;
}

export interface QueryClassification {
    primary_category: string;
    secondary_categories: string[];
    complexity: string;
    urgency: string;
    data_gap: string;
    data_gap_detail: string;
    recommended_template: string;
    classification_confidence: string;
    reasoning: string;
}

export interface QueryResponse {
    response_text: string;
    commitments_made: string[];
    additional_info_needed: string[];
    confidence: string;
    reviewer_flags: string[];
    supporting_documents_referenced: string[];
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const api = {
    // ─── Module 01: Compliance Evaluation ───────────────────────────────

    /**
     * Upload a document file
     */
    uploadDocument: async (file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<UploadResponse>('/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    },

    /**
     * Evaluate a document for compliance
     */
    evaluateDocument: async (
        fileId: string,
        metadata: DocumentMetadata
    ): Promise<EvaluationResponse> => {
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('metadata', JSON.stringify(metadata));

        const response = await apiClient.post<EvaluationResponse>('/api/evaluate', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    },

    // ─── Module 02: Document Generation ─────────────────────────────────

    /**
     * Generate a full document
     */
    generateDocument: async (documentType: string, studyData: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/generate/document', {
            document_type: documentType,
            study_data: studyData,
            generate_all_sections: true,
        });
        return response.data;
    },

    /**
     * Generate a single document section
     */
    generateSection: async (
        documentType: string,
        sectionNumber: string,
        studyData: Record<string, unknown>,
        previousSections?: GeneratedSection[]
    ): Promise<GeneratedSection> => {
        const response = await apiClient.post('/api/generate/section', {
            document_type: documentType,
            section_number: sectionNumber,
            study_data: studyData,
            previous_sections: previousSections,
        });
        return response.data;
    },

    /**
     * Get the schema for a document type
     */
    getDocumentSchema: async (documentType: string): Promise<Record<string, unknown>> => {
        const response = await apiClient.get(`/api/generate/schema/${documentType}`);
        return response.data;
    },

    // ─── Module 03: Query Response ──────────────────────────────────────

    /**
     * Classify a regulatory query
     */
    classifyQuery: async (
        queryText: string,
        queryReference?: string,
        responseDeadline?: string
    ): Promise<QueryClassification> => {
        const response = await apiClient.post('/api/query/classify', {
            query_text: queryText,
            query_reference: queryReference,
            response_deadline: responseDeadline,
        });
        return response.data;
    },

    /**
     * Generate a response to a regulatory query
     */
    generateQueryResponse: async (
        query: Record<string, unknown>,
        classification?: QueryClassification
    ): Promise<QueryResponse> => {
        const response = await apiClient.post('/api/query/respond', {
            query,
            classification,
            auto_classify: !classification,
        });
        return response.data;
    },

    // ─── Module 04: Regulatory Intelligence ─────────────────────────────

    /**
     * Ingest a new regulatory document for monitoring
     */
    ingestRegulatoryDocument: async (
        title: string,
        content: string,
        sourceUrl?: string,
        publishedDate?: string
    ): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/regulatory/ingest', {
            title,
            content,
            source_url: sourceUrl,
            published_date: publishedDate,
        });
        return response.data;
    },

    /**
     * Get recent regulatory changes
     */
    getRecentChanges: async (days: number = 7): Promise<Record<string, unknown>> => {
        const response = await apiClient.get(`/api/regulatory/changes/recent?days=${days}`);
        return response.data;
    },

    /**
     * Generate weekly regulatory digest
     */
    generateDigest: async (startDate: string, endDate: string): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/regulatory/digest/generate', {
            start_date: startDate,
            end_date: endDate,
        });
        return response.data;
    },

    // ─── Knowledge Base ─────────────────────────────────────────────────

    /**
     * Get knowledge base statistics
     */
    getKBStats: async (): Promise<Record<string, unknown>> => {
        const response = await apiClient.get('/api/kb/stats');
        return response.data;
    },

    /**
     * Populate sample knowledge base
     */
    populateSampleKB: async (): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/kb/populate-sample');
        return response.data;
    },

    // ─── Health & Status ────────────────────────────────────────────────

    /**
     * Basic health check
     */
    healthCheck: async (): Promise<Record<string, unknown>> => {
        const response = await apiClient.get('/');
        return response.data;
    },

    /**
     * Detailed readiness check
     */
    readinessCheck: async (): Promise<Record<string, unknown>> => {
        const response = await apiClient.get('/ready');
        return response.data;
    },

    anonymiseText: async (text: string, fullAnonymisation: boolean): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/anonymise', {
            document: text,
            metadata: {
                mode: fullAnonymisation ? 'full' : 'pseudo',
                full_anonymisation: fullAnonymisation,
            },
        });
        return unwrapAgentResult(response.data);
    },

    summariseSugamApplication: async (documentText: string, checklistType: string = 'ct04'): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/summarise', {
            document: documentText,
            metadata: {
                document_type: 'sugam_application',
                checklist_type: checklistType,
            },
        });
        return unwrapAgentResult(response.data);
    },

    summariseSAECase: async (saeText: string): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/summarise', {
            document: saeText,
            metadata: {
                document_type: 'sae_case',
            },
        });
        return unwrapAgentResult(response.data);
    },

    summariseMeeting: async (transcriptText: string): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/summarise', {
            document: transcriptText,
            metadata: {
                document_type: 'meeting_transcript',
            },
        });
        return unwrapAgentResult(response.data);
    },

    compareVersions: async (v1: string, v2: string, docType: string = 'general'): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/compare/versions', {
            doc_v1_text: v1,
            doc_v2_text: v2,
            doc_type: docType,
        });
        return response.data;
    },

    classifySAE: async (saeText: string): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/classify', {
            document: saeText,
            metadata: {
                document_type: 'sae_case',
            },
        });
        return unwrapAgentResult(response.data);
    },

    checkSAEDuplicate: async (saeCase: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post('/api/classify/duplicate-check', {
            sae_case: saeCase,
        });
        return response.data;
    },

    agentsHealth: async (): Promise<Record<string, unknown>> => {
        const response = await apiClient.get('/api/v1/agents/health');
        return response.data;
    },

    // ─── Agent 03: Completeness Assessment ──────────────────────────────
    assessCompleteness: async (documentText: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/completeness', {
            document: documentText,
            metadata: metadata ?? {},
        });
        return unwrapAgentResult(response.data);
    },

    // ─── Agent 05: Inspection Report Generation ─────────────────────────
    generateInspectionReport: async (findingsText: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/inspection-report', {
            document: findingsText,
            metadata: metadata ?? {},
        });
        return unwrapAgentResult(response.data);
    },

    // ─── Agent 06: Regulatory Q&A (RAG) ─────────────────────────────────
    regulatoryQA: async (question: string, retrievedContext: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/qa', {
            question,
            retrieved_context: retrievedContext,
            metadata: metadata ?? {},
        });
        return unwrapAgentResult(response.data);
    },

    // ─── Agent 07: Schedule Y / CDSCO Compliance ────────────────────────
    checkScheduleY: async (documentText: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/schedule-y', {
            document: documentText,
            metadata: metadata ?? {},
        });
        return unwrapAgentResult(response.data);
    },

    // ─── Agent 08: ICH E6(R3) GCP Compliance ────────────────────────────
    checkICHGCP: async (documentText: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/ich-gcp', {
            document: documentText,
            metadata: metadata ?? {},
        });
        return unwrapAgentResult(response.data);
    },
};

// ─── Generic Agent Callers (Phase 6) ────────────────────────────────────────
// Returns the full AgentEnvelope — callers must read from response.result

/**
 * Generic caller for M1, M2, M3, M4, M5, M7, M8.
 * endpoint example: '/api/v1/agents/anonymise'
 */
export const callAgent = async (
    endpoint: string,
    document: string,
    metadata: object = {}
): Promise<AgentEnvelope> => {
    const response = await apiClient.post<AgentEnvelope>(endpoint, {
        document,
        metadata,
    });
    return response.data; // Always read from response.result
};

/**
 * M6 only — Regulatory Q&A has a different request shape (no document field).
 */
export const callQAAgent = async (
    question: string,
    metadata: object = {}
): Promise<AgentEnvelope> => {
    const response = await apiClient.post<AgentEnvelope>('/api/v1/agents/qa', {
        question,
        retrieved_context: '',
        metadata,
    });
    return response.data; // Always read from response.result
};
