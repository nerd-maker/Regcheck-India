'use client';

import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import OutputActions from '@/components/OutputActions';
import FeedbackWidget from '@/components/FeedbackWidget';
import AIDisclaimer from '@/components/AIDisclaimer';
import HistoryPanel from '@/components/HistoryPanel';
import { saveToHistory, HistoryEntry } from '@/services/history';
import { runCompletenessAssessor, compareDocuments } from '@/services/api';

const MODULE_ID = 'm3-completeness';
const MODULE_NAME = 'Completeness Assessor';

const M3_SAMPLE = `CLINICAL STUDY PROTOCOL - ZP-2024-DIAB-002 Version 1.0
Title: A Phase II, Randomised, Double-blind, Placebo-controlled Study of ZP-101
Sponsor: ZenPharma India Pvt. Ltd., Mumbai | Phase: II - Dose Finding | Indication: Type 2 Diabetes

SECTIONS PRESENT: Study objectives, Inclusion/exclusion criteria, Dose escalation plan,
PK/PD assessments, Adverse event reporting procedures, Central EC approval obtained,
Genotoxicity studies completed (Ames test negative, chromosomal aberration negative)

SECTIONS MISSING: Reproductive toxicity studies, Local EC approvals for sites 2-5,
Hindi/Marathi informed consent forms, Final Statistical Analysis Plan,
Clinical trial insurance documentation, DSMB charter, Drug accountability procedures`;

const validateInput = (text: string): string | null => {
  if (!text || !text.trim()) return 'Please enter or upload a document before running.';
  const wc = text.trim().split(/\s+/).length;
  if (wc < 20) return `Please provide more content - minimum 20 words required (currently ${wc} words).`;
  if (wc > 8000) return 'Document too long - please limit to 8,000 words.';
  return null;
};

const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(safeRender).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const statusColor = (status: string) => {
  const upper = String(status).toUpperCase();
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE', 'NO_CHANGE', 'NO_ACTION', 'PRESENT'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE', 'MAJOR', 'AMENDMENT_REQUIRED', 'NOTIFICATION_REQUIRED', 'INCOMPLETE', 'INCONSISTENT'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

export default function CompletenessAssessor() {
  const [activeTab, setActiveTab] = useState<'assessment' | 'comparison'>('assessment');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [documentType, setDocumentType] = useState<string>('GENERAL');
  const [result, setResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const resultHash = useMemo(() => {
    if (!result) return '';
    const str = JSON.stringify(result).substring(0, 200);
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
    return Math.abs(h).toString(16);
  }, [result]);

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setText(extractedText);
    setUploadError(null);
  };
  const handleUploadError = (uploadMessage: string) => setUploadError(uploadMessage);
  const handleRestore = (entry: HistoryEntry) => setResult(entry.result);

  const runAssessment = async () => {
    const ve = validateInput(text);
    if (ve) { setError(ve); return; }
    setError(null);
    setLoading(true);
    try {
      const response = await runCompletenessAssessor(text, documentType);
      const res = response.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      console.error('Assessment failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const runComparison = async () => {
    if (!fileA || !fileB) return;
    setError(null);
    setLoading(true);
    try {
      const response = await compareDocuments(fileA, fileB);
      setCompareResult(response.result);
    } catch (err: unknown) {
      console.error('Comparison failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit border border-white/10">
        <button
          onClick={() => setActiveTab('assessment')}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'assessment'
              ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          Completeness Assessment
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'comparison'
              ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          Version Comparison
        </button>
      </div>

      {activeTab === 'assessment' ? (
        <div className="glass-panel p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="section-kicker">Completeness lane</div>
              <h3 className="mt-3 text-2xl font-semibold">Submission completeness assessment</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y,
                NDCTR 2019, and ICH requirements.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="status-chip">CDSCO</span>
              <span className="status-chip">Schedule Y</span>
              <span className="status-chip">NDCTR 2019</span>
              <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block">
              Document Type for Specialized Review
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'GENERAL', label: 'General Document' },
                { value: 'SAE_REPORT', label: 'SAE Report' },
                { value: 'PROTOCOL', label: 'Clinical Protocol' },
                { value: 'ICF', label: 'Informed Consent Form' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setDocumentType(type.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    documentType === type.value
                      ? 'bg-teal-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
          {uploadError && (
            <div className="mb-2 flex items-center gap-1 text-xs text-red-400">
              <span>⚠</span> {uploadError}
            </div>
          )}
          <div className="flex items-center justify-between mb-2 mt-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</label>
            <button onClick={() => { setText(M3_SAMPLE); setError(null); }} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Load sample data
            </button>
          </div>
          <textarea
            className="textarea-shell"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="Paste the full submission document text here for completeness evaluation."
          />
          {text && <div className="flex justify-between items-center mt-1.5"><span className="text-xs text-slate-500">{wordCount} words</span>{wordCount > 6000 && <span className="text-xs text-amber-400">⚠ Large document</span>}</div>}

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-400">
              The agent will return section-level completeness, data gaps, and overall readiness.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={runAssessment}
              disabled={loading || !text.trim()}
            >
              {loading ? 'Assessing...' : 'Run completeness check'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="section-kicker">Comparison lane</div>
              <h3 className="mt-3 text-2xl font-semibold">Regulatory document comparison</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Upload two versions of a regulatory document (e.g. Protocol V1 and V2) to identify substantive
                changes and regulatory impact.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Version A (Original)</label>
              <div className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${fileA ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 hover:border-white/20'}`}>
                <input
                  type="file"
                  onChange={(e) => setFileA(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.docx"
                />
                <div className="space-y-1">
                  <div className="text-2xl mb-2">{fileA ? '📄' : '📤'}</div>
                  <div className="text-sm font-medium text-slate-200 truncate px-4">
                    {fileA ? fileA.name : 'Click to upload Original'}
                  </div>
                  <div className="text-xs text-slate-500">PDF or DOCX supported</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Version B (Revised)</label>
              <div className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${fileB ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 hover:border-white/20'}`}>
                <input
                  type="file"
                  onChange={(e) => setFileB(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.docx"
                />
                <div className="space-y-1">
                  <div className="text-2xl mb-2">{fileB ? '📄' : '📤'}</div>
                  <div className="text-sm font-medium text-slate-200 truncate px-4">
                    {fileB ? fileB.name : 'Click to upload Revised'}
                  </div>
                  <div className="text-xs text-slate-500">PDF or DOCX supported</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-white/5 pt-5">
            <p className="text-sm text-slate-400">
              Analysis may take up to 2 minutes for complex documents.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={runComparison}
              disabled={loading || !fileA || !fileB}
            >
              {loading ? 'Comparing Versions...' : 'Run version comparison'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">{elapsed < 10 ? 'Sending to AI agent...' : elapsed < 30 ? 'Analysing document...' : elapsed < 60 ? 'Generating report...' : 'Almost done...'}</div>
            </div>
          </div>
          {elapsed > 20 && <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">If server was inactive, first request takes 30-60 seconds to wake up</div>}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Operation Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assessment' && result && (
        <div className="glass-panel p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ModelAttributionBadge attribution={result?.model_attribution} />
          {result._metadata && (
            <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${result._metadata.confidence_level === 'HIGH' ? 'border-green-500/30 bg-green-500/10 text-green-400' : result._metadata.confidence_level === 'MEDIUM' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
              <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
            </div>
          )}

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              COMPLETENESS ASSESSMENT
              <div className="flex items-center gap-2">
                <span className="status-chip text-sm font-normal normal-case">Score: {safeRender(result.completeness_percentage || result.overall_completeness_score)}</span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.submission_readiness)}`} style={{ padding: '4px 12px' }}>
                  {safeRender(result.submission_readiness)}
                </span>
              </div>
            </h2>
          </div>

          {/* SAE-specific results panel */}
          {result.document_type === 'SAE_REPORT' ? (
            <div className="space-y-6">
              
              {/* SAE Classification */}
              {result.sae_classification && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="metric-label mb-3">SAE Classification</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Reporting Category</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {safeRender(result.sae_classification.reporting_category)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Expedited Reporting</div>
                      <div className={`text-sm font-bold mt-1 ${
                        result.sae_classification.expedited_reporting_required 
                          ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {result.sae_classification.expedited_reporting_required ? 'REQUIRED' : 'NOT REQUIRED'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Timeline</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {safeRender(result.sae_classification.reporting_timeline_days)} days
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Seriousness</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.isArray(result.sae_classification.seriousness_criteria_identified) &&
                          result.sae_classification.seriousness_criteria_identified.map((c: string, i: number) => (
                            <span key={i} className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                              {safeRender(c)}
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mandatory Fields Table */}
              {Array.isArray(result.mandatory_fields) && result.mandatory_fields.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="metric-label mb-4">Mandatory Fields Check (Rule 19 / ICH E2A)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.mandatory_fields.map((field: {
                      field_name: string
                      regulation: string
                      status: string
                      value_found: string
                      issue: string
                    }, i: number) => (
                      <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${
                        field.status === 'PRESENT' ? 'bg-green-500/5 border-green-500/20' :
                        field.status === 'MISSING' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-amber-500/5 border-amber-500/20'
                      }`}>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                          field.status === 'PRESENT' ? 'bg-green-500/20 text-green-400' :
                          field.status === 'MISSING' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {safeRender(field.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-100">{safeRender(field.field_name)}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{safeRender(field.regulation)}</div>
                          {field.issue && (
                            <div className="text-xs text-red-400 mt-2 font-medium bg-red-500/10 p-2 rounded-lg">⚠ {safeRender(field.issue)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Timeline Compliance */}
                {result.timeline_compliance && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <div className="metric-label mb-3 text-xs">Timeline Compliance</div>
                    <div className="space-y-2">
                      {Object.entries(result.timeline_compliance).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-xs text-slate-300">
                          <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={typeof value === 'boolean' 
                            ? (value ? 'text-green-400 font-bold' : 'text-red-400 font-bold') 
                            : 'text-white font-semibold'
                          }>
                            {typeof value === 'boolean' ? (value ? '✓' : '✗') : safeRender(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Causality Assessment */}
                {result.causality_assessment && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <div className="metric-label mb-3 text-xs">Causality Assessment</div>
                    <div className="space-y-2">
                      {Object.entries(result.causality_assessment).map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1 text-xs text-slate-300">
                          <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={typeof value === 'boolean'
                            ? (value ? 'text-green-400' : 'text-red-400')
                            : 'text-white font-semibold'
                          }>
                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeRender(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Narrative Quality */}
                {result.narrative_quality && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <div className="metric-label mb-3 text-xs">Narrative Quality</div>
                    <div className="space-y-2">
                      {Object.entries(result.narrative_quality).map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1 text-xs text-slate-300">
                          <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-white">
                            {Array.isArray(value) 
                              ? <div className="space-y-0.5">{value.map((v, i) => <div key={i} className="text-[10px]">• {safeRender(v)}</div>)}</div>
                              : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeRender(value)
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
                  <div className="text-[10px] font-bold uppercase text-amber-400 tracking-widest mb-3">Recommendations</div>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="text-sm text-amber-200 flex gap-3">
                        <span className="shrink-0">✦</span>
                        {safeRender(rec)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[SCORE]</div>
                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div className={`h-full ${parseFloat(String(result.overall_completeness_score || result.completeness_percentage || 0)) > 80 ? 'bg-green-500' : parseFloat(String(result.overall_completeness_score || result.completeness_percentage || 0)) > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${parseFloat(String(result.overall_completeness_score || 0))}%` }}></div>
                </div>
              </div>

              {result.regulatory_requirements_met && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[REQUIREMENTS MET]</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.regulatory_requirements_met).map(([key, value]) => {
                      const isMet = Boolean(value);
                      return (
                        <div key={key} className={`rounded-xl border px-3 py-1.5 flex items-center gap-2 ${isMet ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                          {isMet ? '✓' : '✗'} <span className="uppercase text-xs font-semibold">{key.replace(/_/g, ' ')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {Array.isArray(result.present_sections) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-green-400 mb-3 flex items-center gap-2">✓ Present Sections</div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {result.present_sections.map((item: any, i: number) => <li key={i} className="bg-white/5 px-2 py-1 rounded">{safeRender(item)}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(result.incomplete_sections) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">⚠ Incomplete Sections</div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {result.incomplete_sections.map((item: any, i: number) => <li key={i} className="bg-amber-400/10 px-2 py-1 rounded text-amber-200">{safeRender(item)}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(result.missing_sections) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">✗ Missing Sections</div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {result.missing_sections.map((item: any, i: number) => <li key={i} className="bg-red-400/10 px-2 py-1 rounded text-red-200">{safeRender(item)}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {Array.isArray(result.critical_gaps) && result.critical_gaps.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">Critical Gaps</div>
                    <div className="space-y-2">
                      {result.critical_gaps.map((item: any, i: number) => (
                        <div key={i} className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                          {safeRender(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(result.minor_gaps) && result.minor_gaps.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">Minor Gaps</div>
                    <div className="space-y-2">
                      {result.minor_gaps.map((item: any, i: number) => (
                        <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                          {safeRender(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {Array.isArray(result.priority_actions) && result.priority_actions.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Priority Actions</div>
                    <div className="space-y-2">
                      {result.priority_actions.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-start border-l-2 border-red-500/50 pl-3">
                          <span className="text-xs font-bold text-red-500 mt-0.5">{i + 1}.</span>
                          <span className="text-sm text-slate-300 leading-relaxed">{safeRender(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recommendations</div>
                    <div className="space-y-2">
                      {result.recommendations.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-start border-l-2 border-amber-500/50 pl-3">
                          <span className="text-xs font-bold text-amber-500 mt-0.5">{i + 1}.</span>
                          <span className="text-sm text-slate-300 leading-relaxed">{safeRender(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-400">Audit Log</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>{safeRender(result.audit_log.sections_checked || result.audit_log.fields_checked)} items checked</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
              </div>
            </div>
          )}
          <AIDisclaimer />
          <OutputActions result={result} moduleName={MODULE_NAME} textContent={`RegCheck-India - ${MODULE_NAME} Result\nGenerated: ${new Date().toLocaleString()}\n\nScore: ${result.completeness_percentage || result.overall_completeness_score || ''}\nReadiness: ${result.submission_readiness || ''}\n\nCritical Gaps: ${(result.critical_gaps || []).join('; ')}\nPriority Actions: ${(result.priority_actions || []).join('; ')}`} />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}

      {/* Comparison Results Rendering */}
      {activeTab === 'comparison' && compareResult && (
        <div className="glass-panel p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ModelAttributionBadge attribution={compareResult?.model_attribution} />

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              VERSION COMPARISON
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(compareResult.overall_change_severity)}`} style={{ padding: '4px 12px' }}>
                  {safeRender(compareResult.overall_change_severity)} severity
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(compareResult.submission_impact)}`} style={{ padding: '4px 12px' }}>
                  {safeRender(compareResult.submission_impact)}
                </span>
              </div>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Executive Summary</div>
              <p className="text-sm text-slate-200 leading-relaxed">{safeRender(compareResult.executive_summary)}</p>
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                <span className="font-bold">Impact Rationale:</span> {safeRender(compareResult.submission_impact_rationale)}
              </div>
            </div>
            
            <div className="space-y-4">
              {Array.isArray(compareResult.critical_changes) && compareResult.critical_changes.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">Critical Changes</div>
                  <ul className="space-y-2">
                    {compareResult.critical_changes.map((change: any, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-red-500">•</span> {safeRender(change)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">[DETAILED CHANGES]</div>
          <div className="space-y-6">
            {Array.isArray(compareResult.changes) && compareResult.changes.map((change: any, i: number) => (
              <div key={i} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/5 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500">{safeRender(change.change_id)}</span>
                    <span className="text-sm font-semibold text-slate-100">{safeRender(change.section)}</span>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${
                      change.change_type === 'ADDED' ? 'bg-green-500/20 text-green-400' :
                      change.change_type === 'REMOVED' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {safeRender(change.change_type)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusColor(change.severity)}`}>
                    {safeRender(change.severity)}
                  </span>
                </div>
                
                <div className="p-5">
                  <p className="text-sm text-slate-200 mb-4">{safeRender(change.description)}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {change.original_text && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Original</span>
                        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-slate-400 italic line-through decoration-red-500/30">
                          {safeRender(change.original_text)}
                        </div>
                      </div>
                    )}
                    {change.revised_text && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Revised</span>
                        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-slate-200">
                          {safeRender(change.revised_text)}
                        </div>
                      </div>
                    )}
                  </div>

                  {change.regulatory_impact && (
                    <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-teal-400">⚖</span>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-tight">Regulatory Impact</span>
                        <span className="ml-auto text-[10px] text-slate-500 italic">{safeRender(change.regulatory_impact.regulation)}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{safeRender(change.regulatory_impact.impact_description)}</p>
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Risk Level</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor(change.regulatory_impact.compliance_risk)}`}>
                            {safeRender(change.regulatory_impact.compliance_risk)}
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-teal-300 bg-teal-500/10 px-2 py-1 rounded-lg">
                          Action: {safeRender(change.regulatory_impact.action_required)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {compareResult.audit_log && (
            <div className="mt-8 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-400">Audit Log</span>
                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full">
                  <span className="opacity-50">V1:</span> <span className="text-slate-300 max-w-[120px] truncate">{safeRender(compareResult.audit_log.file_a)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full">
                  <span className="opacity-50">V2:</span> <span className="text-slate-300 max-w-[120px] truncate">{safeRender(compareResult.audit_log.file_b)}</span>
                </div>
                <span>•</span>
                <span>{safeRender(compareResult.audit_log.timestamp)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
