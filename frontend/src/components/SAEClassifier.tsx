'use client';

import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import OutputActions from '@/components/OutputActions';
import FeedbackWidget from '@/components/FeedbackWidget';
import AIDisclaimer from '@/components/AIDisclaimer';
import HistoryPanel from '@/components/HistoryPanel';
import { saveToHistory, HistoryEntry } from '@/services/history';
import { useServerStatus } from '@/hooks/useServerStatus';
import { moduleTransferStore } from '@/store/moduleTransfer';
import { runCaseClassifier } from '@/services/api';

const MODULE_ID = 'm4-classifier';
const MODULE_NAME = 'Case Classifier';

const M4_SAMPLE = `CASE NARRATIVE - SAE Report CASE-2025-0089
Study: Phase III study of BX-400 in complicated urinary tract infections
Patient: 67-year-old female, history of recurrent UTIs, mild CKD (eGFR 52)
Study Day 1: First dose BX-400 400mg IV administered
Study Day 4: Sudden onset severe dyspnoea, urticaria, hypotension (BP 80/50 mmHg)
Action: Transferred to ICU within 30 minutes. Emergency treatment initiated.
IV adrenaline 0.5mg, IV hydrocortisone 200mg, IV fluids.
Patient stabilised within 4 hours. Discharged from ICU after 48 hours monitoring.
Study drug permanently discontinued.
Investigator causality: PROBABLY RELATED to study drug.
Event NOT listed in current Investigator Brochure Version 3.0, January 2025.
Date of event: Study Day 4. Reported to sponsor: Study Day 5 (within 24 hours).`;

const severityAccent: Record<string, string> = {
  DEATH: '#ff8aa1', LIFE_THREATENING: '#ffb26b', HOSPITALISATION: '#ffd166',
  DISABILITY: '#9ad1ff', CONGENITAL_ANOMALY: '#79e1d6', OTHER: '#d8e5f3',
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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE'].includes(upper)) return 'text-green-400 bg-green-400/10';
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE'].includes(upper)) return 'text-amber-400 bg-amber-400/10';
  return 'text-red-400 bg-red-400/10';
};

const validateInput = (text: string): string | null => {
  if (!text || !text.trim()) return 'Please enter or upload a document before running.';
  const wc = text.trim().split(/\s+/).length;
  if (wc < 20) return `Please provide more content - minimum 20 words required (currently ${wc} words).`;
  if (wc > 8000) return 'Document too long - please limit to 8,000 words.';
  return null;
};

export default function SAEClassifier() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { status } = useServerStatus();
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

  const handleTextExtracted = (t: string) => { setText(t); setUploadError(null); };
  const handleUploadError = (m: string) => setUploadError(m);
  const handleRestore = (entry: HistoryEntry) => setResult(entry.result);

  const run = async () => {
    const ve = validateInput(text);
    if (ve) { setError(ve); return; }
    setError(null); setLoading(true);
    try {
      const response = await runCaseClassifier(text);
      const res = response.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      setResult(null);  // Clear stale result to prevent React render crash
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Safety triage</div>
            <h3 className="mt-3 text-2xl font-semibold">SAE classifier and duplicate review</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Classify seriousness, surface duplicate risk, and generate a clearer queueing signal for reviewers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">WHO-UMC</span>
            <span className="status-chip">Duplicate signals</span>
            <span className="status-chip">Priority scoring</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>{status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}</span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
          </div>
        </div>
        <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
        {uploadError && <div className="mb-2 flex items-center gap-1 text-xs text-red-400"><span>⚠</span> {uploadError}</div>}
        <div className="flex items-center justify-between mb-2 mt-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</label>
          <button onClick={() => { setText(M4_SAMPLE); setError(null); }} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Load sample data
          </button>
        </div>
        <textarea className="textarea-shell" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} placeholder="Paste the SAE narrative, onset details, suspect product, outcome, and reporter summary." />
        {text && (
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${
                wordCount === 0 ? 'text-slate-500' :
                wordCount < 20 ? 'text-red-400' :
                wordCount < 50 ? 'text-amber-400' :
                wordCount <= 3000 ? 'text-green-400' :
                wordCount <= 6000 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {wordCount} words
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                wordCount === 0 ? 'hidden' :
                wordCount < 20 ? 'bg-red-500/10 text-red-400' :
                wordCount < 50 ? 'bg-amber-500/10 text-amber-400' :
                wordCount <= 3000 ? 'bg-green-500/10 text-green-400' :
                wordCount <= 6000 ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {wordCount < 20 ? 'Too short' :
                 wordCount < 50 ? 'Add more context' :
                 wordCount <= 3000 ? 'Optimal' :
                 wordCount <= 6000 ? 'Long — may be slow' :
                 'Too long — will be truncated'}
              </span>
            </div>
            {wordCount >= 50 && (
              <span className="text-xs text-slate-500">
                ~{wordCount <= 1000 ? '15-30' :
                   wordCount <= 3000 ? '30-60' :
                   wordCount <= 6000 ? '60-90' : '90+'} seconds
              </span>
            )}
          </div>
        )}
        {wordCount > 0 && (
          <div className="mt-1 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                wordCount < 50 ? 'bg-red-500' :
                wordCount <= 3000 ? 'bg-green-500' :
                wordCount <= 6000 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min((wordCount / 6000) * 100, 100)}%` }}
            />
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" className="primary-button" onClick={run} disabled={loading || !text.trim()}>{loading ? 'Classifying...' : 'Classify SAE'}</button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">{elapsed < 10 ? 'Sending to AI agent...' : elapsed < 30 ? 'Classifying SAE...' : elapsed < 60 ? 'Generating report...' : 'Almost done...'}</div>
            </div>
          </div>
          {elapsed > 20 && <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">If server was inactive, first request takes 30-60 seconds to wake up</div>}
        </div>
      )}

      {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4"><div className="text-red-400 font-medium text-sm">Request Failed</div><div className="text-red-300 text-sm mt-1">{error}</div></div>}

      {result && (
        <div className="space-y-6">
          {result.duplicate_detection && (
            <div className={`rounded-2xl border px-6 py-5 mb-4 ${result.duplicate_detection.duplicates_found ? 'border-red-500/30 bg-red-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${result.duplicate_detection.duplicates_found ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="font-semibold text-sm">{result.duplicate_detection.duplicates_found ? `⚠ ${result.duplicate_detection.match_count} Potential Duplicate(s) Detected` : '✓ No Duplicates Found — Case Appears Unique'}</div>
              </div>
              <div className="text-sm text-slate-300">{safeRender(result.duplicate_detection.recommendation)}</div>
            </div>
          )}
          <div className="glass-panel p-6">
            <ModelAttributionBadge attribution={result?.model_attribution} />
            {result._metadata && (
              <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${result._metadata.confidence_level === 'HIGH' ? 'border-green-500/30 bg-green-500/10 text-green-400' : result._metadata.confidence_level === 'MEDIUM' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
              </div>
            )}
            <div className="border-b border-white/10 pb-4 mb-6 mt-4">
              <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                Case Classification
                <div className="flex items-center gap-2">
                  <span className="status-chip text-sm font-normal normal-case">{safeRender(result.primary_category)}</span>
                  <span className="status-chip text-sm font-normal normal-case">Priority: {safeRender(result.priority_score)}/10</span>
                  <span className={`status-chip text-sm font-medium ${result.requires_expedited_reporting ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-white/5'}`} style={{ padding: '4px 12px' }}>{result.requires_expedited_reporting ? 'EXPEDITED REPORTING REQUIRED' : 'ROUTINE REPORTING'}</span>
                </div>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Classification Overview</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div><div className="text-xs text-slate-400">Primary Category</div><div className="text-2xl font-bold mt-1 text-slate-100">{safeRender(result.primary_category)}</div></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-xs text-slate-400">Confidence</div><div className="text-lg font-semibold mt-1">{safeRender(result.confidence)}%</div></div>
                    <div><div className="text-xs text-slate-400">Priority Score</div><div className="text-lg font-semibold mt-1">{safeRender(result.priority_score)} / 10</div></div>
                  </div>
                  <div><div className="text-xs text-slate-400">Expedited Reporting</div><div className="text-lg font-semibold mt-1">{result.requires_expedited_reporting ? 'YES' : 'NO'}</div></div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Seriousness Criteria</div>
                <div className="flex flex-col gap-2">
                  {Array.isArray(result.seriousness_criteria)
                    ? <div className="flex flex-wrap gap-2">{result.seriousness_criteria.map((item: string, i: number) => <span key={i} className="status-chip text-red-300 bg-red-400/10">{safeRender(item)}</span>)}</div>
                    : Object.entries(result.seriousness_criteria || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full justify-between border-b border-white/5 pb-1">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={value ? 'text-red-400 font-medium' : 'text-slate-500'}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeRender(value)}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
            {result.causality && (
              <div className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Causality Assessment</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`status-chip font-bold ${statusColor(result.causality.assessment)}`}>{safeRender(result.causality.assessment)}</span>
                    <span className="text-sm text-slate-400">WHO-UMC Category:</span>
                    <span className="text-sm font-semibold text-slate-200">{safeRender(result.causality.who_umc_category)}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">{safeRender(result.causality.rationale)}</p>
                </div>
              </div>
            )}
            {Array.isArray(result.regulatory_actions_required) && result.regulatory_actions_required.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory Actions Required</div>
                <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-amber-200">
                    {result.regulatory_actions_required.map((action: string, i: number) => <li key={i} className="pl-1 leading-relaxed">{safeRender(action)}</li>)}
                  </ol>
                </div>
              </div>
            )}
            {result.audit_log && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                  <span>{safeRender(result.audit_log.timestamp)}</span>
                  <span>•</span>
                  <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>{safeRender(result.audit_log.status)}</span>
                </div>
              </div>
            )}
            <AIDisclaimer />
            <OutputActions result={result} moduleName={MODULE_NAME}
              moduleId={MODULE_ID}
              inputSnippet={text.substring(0, 150)}
              pipeableContent={`SAE Category: ${result.primary_category}\nPriority: ${result.priority_score}/10\nReporting: ${result.requires_expedited_reporting ? 'Expedited' : 'Standard'}\nActions: ${(result.regulatory_actions_required || []).join(', ')}`}
              pipeableLabel="SAE classification"
              textContent={`RegCheck-India - ${MODULE_NAME} Result\nGenerated: ${new Date().toLocaleString()}\n\nCategory: ${result.primary_category || ''}\nPriority: ${result.priority_score || ''}/10\nExpedited Reporting: ${result.requires_expedited_reporting ? 'YES' : 'NO'}\nCausality: ${result.causality?.assessment || ''}\n\nRegulatory Actions: ${(result.regulatory_actions_required || []).join('; ')}`} />
            <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
          </div>
        </div>
      )}
    </div>
  );
}
