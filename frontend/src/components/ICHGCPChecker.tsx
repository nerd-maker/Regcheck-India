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
import { RegulationCitation } from '@/utils/regulatoryLinks';
import { runICHGCPChecker } from '@/services/api';

const MODULE_ID = 'm8-ich-gcp';
const MODULE_NAME = 'ICH E6(R3) GCP Checker';

const M8_SAMPLE = `GCP COMPLIANCE AUDIT - Phase III Clinical Trial Site Assessment
Site: Apollo Hospitals, Hyderabad | Trial: BX-400 Phase III, Complicated UTI Study
FINDINGS:
- No documented Quality Management System for trial operations
- Risk-Based Monitoring: Fixed monitoring intervals, no centralized monitoring plan
- PI Training: 2 of 6 required training modules completed
- Informed Consent: 7 of 18 subjects not re-consented post protocol amendment v2.0
- EDC System: User access authorization logs unavailable for 6 months
- Audit trail: 5 data change entries without reason codes
- Source Data Verification: 100% SDV conducted with no risk-based justification
- Delegation Log: 3 new sub-investigators added but not listed in delegation log
- Essential Documents: QMS documentation, re-consent forms, system validation docs missing`;

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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE','HIGH','STRONG','YES'].includes(upper)) return 'text-green-400 bg-green-400/10';
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE','MINOR'].includes(upper)) return 'text-amber-400 bg-amber-400/10';
  return 'text-red-400 bg-red-400/10';
};

const validateInput = (text: string): string | null => {
  if (!text || !text.trim()) return 'Please enter or upload a document before running.';
  const wc = text.trim().split(/\s+/).length;
  if (wc < 20) return `Please provide more content - minimum 20 words required (currently ${wc} words).`;
  if (wc > 8000) return 'Document too long - please limit to 8,000 words.';
  return null;
};

export default function ICHGCPChecker() {
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

  const runCheck = async () => {
    const ve = validateInput(text);
    if (ve) { setError(ve); return; }
    setError(null); setLoading(true);
    try {
      const response = await runICHGCPChecker(text);
      const res = response.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">GCP lane</div>
            <h3 className="mt-3 text-2xl font-semibold">ICH E6(R3) GCP compliance</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Assess documents against ICH E6(R3) Good Clinical Practice. Identifies R3-specific gaps, inspection risks, strengths, and overall inspection readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">ICH E6(R3)</span>
            <span className="status-chip">GCP</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>
              {status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}
            </span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
          </div>
        </div>
        <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
        {uploadError && <div className="mb-2 flex items-center gap-1 text-xs text-red-400"><span>⚠</span> {uploadError}</div>}
        <div className="flex items-center justify-between mb-2 mt-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</label>
          <button onClick={() => { setText(M8_SAMPLE); setError(null); }} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Load sample data
          </button>
        </div>
        <textarea className="textarea-shell" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} placeholder="Paste the document text for ICH E6(R3) GCP compliance assessment." />
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
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">Returns GCP compliance status, R3-specific gaps, strengths, and inspection readiness.</p>
          <button type="button" className="primary-button" onClick={runCheck} disabled={loading || !text.trim()}>{loading ? 'Assessing...' : 'Run GCP compliance check'}</button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">{elapsed < 10 ? 'Sending to AI agent...' : elapsed < 30 ? 'Analysing document...' : elapsed < 60 ? 'Generating compliance report...' : 'Almost done, please wait...'}</div>
            </div>
          </div>
          {elapsed > 20 && <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">If server was inactive, first request takes 30-60 seconds to wake up</div>}
        </div>
      )}

      {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4"><div className="text-red-400 font-medium text-sm">Request Failed</div><div className="text-red-300 text-sm mt-1">{error}</div></div>}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />
          {result._metadata && (
            <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${result._metadata.confidence_level === 'HIGH' ? 'border-green-500/30 bg-green-500/10 text-green-400' : result._metadata.confidence_level === 'MEDIUM' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
              <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
            </div>
          )}
          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              ICH E6(R3) Compliance
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.overall_gcp_status || result.overall_status || 'UNKNOWN')}`} style={{ padding: '4px 12px' }}>Status: {safeRender(result.overall_gcp_status || result.overall_status || 'Unknown')}</span>
                <span className="status-chip text-sm font-normal normal-case">Score: {safeRender(result.gcp_score)} ({safeRender(result.gcp_percentage)})</span>
              </div>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><div className="text-xs text-slate-400 uppercase font-bold mb-1">Principles</div><div className="text-2xl font-bold">{result.gcp_principles?.length ?? 0}</div></div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center"><div className="text-xs text-red-400 uppercase font-bold mb-1">Critical</div><div className="text-2xl font-bold text-red-300">{result.critical_deviations?.length ?? 0}</div></div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center"><div className="text-xs text-amber-400 uppercase font-bold mb-1">Major</div><div className="text-2xl font-bold text-amber-300">{result.major_deviations?.length ?? 0}</div></div>
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4 text-center"><div className="text-xs text-yellow-500 uppercase font-bold mb-1">Minor</div><div className="text-2xl font-bold text-yellow-400">{result.minor_deviations?.length ?? 0}</div></div>
          </div>
          {(Array.isArray(result.critical_deviations) && result.critical_deviations.length > 0) && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Critical Deviations</div>
              <div className="space-y-2">
                {result.critical_deviations.map((item: string, i: number) => (
                  <div key={i} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-red-300 bg-red-500/20 mt-0.5 whitespace-nowrap">CRITICAL</span><span>{safeRender(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(result.gcp_principles) && result.gcp_principles.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">GCP Principles Checked</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase text-slate-400">
                    <tr><th className="px-4 py-3 font-semibold w-1/4">Principle</th><th className="px-4 py-3 font-semibold">ICH Reference</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Observation</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.gcp_principles.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-medium text-slate-200">{safeRender(item.principle)}</td>
                        <td className="px-4 py-3 text-xs">
                          <RegulationCitation citation={safeRender(item.ich_reference)} />
                        </td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(item.status)}`}>{safeRender(item.status)}</span></td>
                        <td className="px-4 py-3 text-xs"><div>{safeRender(item.observation)}</div>{item.corrective_action && <div className="text-amber-300/80 mt-1"><span className="font-bold">CAPA:</span> {safeRender(item.corrective_action)}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">Recommendations</div>
              <div className="space-y-1 text-sm text-blue-300">{result.recommendations.map((item: string, i: number) => <div key={i}>• {safeRender(item)}</div>)}</div>
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
            pipeableContent={`GCP Status: ${result.overall_gcp_status}\nScore: ${result.gcp_score} (${result.gcp_percentage})\nCritical: ${(result.critical_deviations || []).join(', ')}\nRecommendations: ${(result.recommendations || []).join(', ')}`}
            pipeableLabel="GCP results"
            textContent={`RegCheck-India - ${MODULE_NAME} Result\nGenerated: ${new Date().toLocaleString()}\n\nGCP Status: ${result.overall_gcp_status || ''}\nScore: ${result.gcp_score || ''} (${result.gcp_percentage || ''})\n\nCritical: ${(result.critical_deviations || []).join('; ')}\nRecommendations: ${(result.recommendations || []).join('; ')}`} />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  );
}
