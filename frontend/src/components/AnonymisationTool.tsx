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
import { runPIIAnonymiser } from '@/services/api';
import { moduleTransferStore } from '@/store/moduleTransfer';

const MODULE_ID = 'm1-anonymise';
const MODULE_NAME = 'PII Anonymiser';

const M1_SAMPLE = `Patient: Mr. Rajesh Kumar, DOB: 12-May-1978, Patient ID: KEM/2024/0892
Site: KEM Hospital, Mumbai. Investigator: Dr. Priya Sharma, MCI Reg: MH-45231
Contact: rajesh.kumar@email.com, +91-9876543210
Current status: Recovering, still hospitalised as of 25-March-2024
Causality assessment: Probably related to study drug BX-400 400mg IV
Ethics Committee: Independent Ethics Committee of Pune
Contact: Mr. Deepak Nair, Secretary, IEC-Pune, deepak.nair@iecpune.org`;

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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

const validateInput = (text: string, minWords: number = 20): string | null => {
  if (!text || !text.trim()) return 'Please enter or upload a document before running.';
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < minWords) return `Please provide more content — minimum ${minWords} words required (currently ${wordCount} words).`;
  if (wordCount > 8000) return 'Document too long — please limit to 8,000 words for best results.';
  return null;
};

export default function AnonymisationTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'pseudo' | 'full'>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { status } = useServerStatus();
  const [elapsed, setElapsed] = useState(0);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    // Check for piped content from another module
    const transfer = moduleTransferStore.receive(MODULE_ID);
    if (transfer) {
      setText(transfer.content);
      setError(null);
    }

    // Subscribe to live transfers
    const unsub = moduleTransferStore.subscribe(MODULE_ID, (payload) => {
      setText(payload.content);
    });
    return () => { unsub(); };
  }, []);

  const resultHash = useMemo(() => {
    if (!result) return '';
    const str = JSON.stringify(result).substring(0, 200);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }, [result]);

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setText(extractedText);
    setUploadError(null);
  };

  const handleUploadError = (uploadMessage: string) => {
    setUploadError(uploadMessage);
  };

  const runAnonymise = async () => {
    const validationError = validateInput(text);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setLoading(true);
    try {
      const response = await runPIIAnonymiser(text, { mode: mode === 'full' ? 'full' : 'pseudo', full_anonymisation: mode === 'full' });
      const res = { ...response.result, mode };
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      console.error('Anonymisation failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (entry: HistoryEntry) => {
    setResult(entry.result);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Privacy lane</div>
            <h3 className="mt-3 text-2xl font-semibold">PII and PHI anonymisation</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Run reversible pseudonymisation or full anonymisation with compliance reporting and
              legal basis tracking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">DPDP</span>
            <span className="status-chip">NDHM</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>
              {status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}
            </span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('pseudo')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'pseudo' ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-300'
            }`}
          >
            Pseudonymise only
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'full' ? 'bg-teal-300 text-slate-950' : 'bg-white/5 text-slate-300'
            }`}
          >
            Full anonymisation
          </button>
        </div>

        <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
        {uploadError && (
          <div className="mb-2 flex items-center gap-1 text-xs text-red-400">
            <span>⚠</span> {uploadError}
          </div>
        )}

        <div className="flex items-center justify-between mb-2 mt-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</label>
          <button
            onClick={() => { setText(M1_SAMPLE); setError(null); }}
            className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Load sample data
          </button>
        </div>
        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Paste patient narratives, site details, or investigator notes here."
        />
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
              }`}>{wordCount} words</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                wordCount === 0 ? 'hidden' :
                wordCount < 20 ? 'bg-red-500/10 text-red-400' :
                wordCount < 50 ? 'bg-amber-500/10 text-amber-400' :
                wordCount <= 3000 ? 'bg-green-500/10 text-green-400' :
                wordCount <= 6000 ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {wordCount < 20 ? 'Too short' : wordCount < 50 ? 'Add more context' : wordCount <= 3000 ? 'Optimal' : wordCount <= 6000 ? 'Long — may be slow' : 'Too long — will be truncated'}
              </span>
            </div>
            {wordCount >= 50 && <span className="text-xs text-slate-500">~{wordCount <= 1000 ? '15-30' : wordCount <= 3000 ? '30-60' : wordCount <= 6000 ? '60-90' : '90+'} seconds</span>}
          </div>
        )}
        {wordCount > 0 && (
          <div className="mt-1 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${wordCount < 50 ? 'bg-red-500' : wordCount <= 3000 ? 'bg-green-500' : wordCount <= 6000 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min((wordCount / 6000) * 100, 100)}%` }} />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Structured reports will show entity counts, legal frameworks, and audit log summaries.
          </p>
          <button type="button" className="primary-button" onClick={runAnonymise} disabled={loading || !text.trim()}>
            {loading ? 'Processing...' : 'Run anonymisation'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {elapsed < 10 && "Sending to AI agent..."}
                {elapsed >= 10 && elapsed < 30 && "Analysing document against regulations..."}
                {elapsed >= 30 && elapsed < 60 && "Generating structured compliance report..."}
                {elapsed >= 60 && "Large document — almost done, please wait..."}
              </div>
            </div>
          </div>
          {elapsed > 20 && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              If server was inactive, first request takes 30-60 seconds to wake up
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Request Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass-panel p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          {result._metadata && (
            <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${
              result._metadata.confidence_level === 'HIGH'
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : result._metadata.confidence_level === 'MEDIUM'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
              <span className="ml-auto text-slate-500 font-normal">{result._metadata.reviewed_by}</span>
            </div>
          )}

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100">
                PII DETECTION &amp; ANONYMISATION
              </h2>
              <div className="flex items-center gap-2">
                <span className="status-chip text-sm normal-case font-medium">
                  {safeRender(result.entities_anonymised)} Entities Removed
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.risk_level || 'LOW')}`} style={{ padding: '4px 12px' }}>
                  Risk: {safeRender(result.risk_level || 'LOW')}
                </span>
              </div>
            </div>
            
            {result.detection_method && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400 bg-teal-400/10 px-3 py-1 rounded-lg border border-teal-500/20">
                  {safeRender(result.detection_method)}
                </span>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[ANONYMISED TEXT]</div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {safeRender(result.anonymised_content)}
            </div>
          </div>

          {Array.isArray(result.entities_detected) && result.entities_detected.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[ENTITIES REMOVED]</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 text-[10px] uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/4">Entity Type</th>
                      <th className="px-4 py-3 font-semibold w-1/4">Original Value</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 font-semibold">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.entities_detected.map((entity: any, i: number) => {
                      const isPHI = String(entity.category || '').toUpperCase().includes('PHI');
                      return (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium text-slate-200">{safeRender(entity.entity_type)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{safeRender(entity.value)}</td>
                          <td className="px-4 py-3">
                            <span className={`status-chip text-[10px] ${isPHI ? 'text-blue-400 bg-blue-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                              {safeRender(entity.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              entity.detection_method === 'RULE_BASED' 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'text-slate-500 bg-white/5'
                            }`}>
                              {entity.detection_method === 'RULE_BASED' ? 'RULE-BASED' : 'AI'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{safeRender(entity.position)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.rule_based_summary && result.rule_based_summary.total_detections > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">
                Rule-Based Pre-Scan Results
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-xl font-bold text-blue-400">{safeRender(result.rule_based_summary.total_detections)}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">Total Detected</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-400">{safeRender(result.rule_based_summary.pii_count)}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">PII Items</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-purple-400">{safeRender(result.rule_based_summary.phi_count)}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">PHI Items</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-400">{safeRender(result.rule_based_summary.high_confidence)}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">High Confidence</div>
                </div>
              </div>
            </div>
          )}

          {Array.isArray(result.compliance_frameworks) && result.compliance_frameworks.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[COMPLIANCE]</div>
              <div className="flex flex-wrap gap-2">
                {result.compliance_frameworks.map((fw: any, i: number) => (
                  <span key={i} className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
                    {safeRender(fw)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.anonymisation_report && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Anonymisation Report</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">PII Removed</div>
                    <div className="mt-1 text-2xl font-bold text-slate-100">{safeRender(result.anonymisation_report.pii_removed)}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">PHI Removed</div>
                    <div className="mt-1 text-2xl font-bold text-slate-100">{safeRender(result.anonymisation_report.phi_removed)}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Clinical Integrity</div>
                    <div className="mt-2">
                      <span className={statusColor(result.anonymisation_report.clinical_integrity)} style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        {safeRender(result.anonymisation_report.clinical_integrity)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-4">
                  {safeRender(result.anonymisation_report.summary)}
                  {result.anonymisation_report.notes && (
                    <div className="mt-2 text-xs italic text-slate-400">
                      Note: {safeRender(result.anonymisation_report.notes)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-400">Audit Log</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>Mode: {safeRender(result.audit_log.mode)}</span>
                <span>•</span>
                <span>LLM: {safeRender(result.audit_log.anonymisation_method)}</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
                <span>•</span>
                <span>{safeRender(result.audit_log.entities_processed)} entities processed</span>
              </div>
            </div>
          )}

          <AIDisclaimer />

          <OutputActions
            result={result}
            moduleName={MODULE_NAME}
            moduleId={MODULE_ID}
            inputSnippet={text.substring(0, 150)}
            pipeableContent={result.anonymised_content}
            pipeableLabel="anonymised text"
            textContent={
              `RegCheck-India — ${MODULE_NAME} Result\n` +
              `Generated: ${new Date().toLocaleString()}\n\n` +
              `Anonymised Content:\n${result.anonymised_content || ''}\n\n` +
              `Entities Detected: ${result.entities_anonymised || 0}\n` +
              `Compliance: ${(result.compliance_frameworks || []).join(', ')}`
            }
          />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  );
}
