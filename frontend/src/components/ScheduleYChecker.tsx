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
import { runScheduleYCompliance } from '@/services/api';

const MODULE_ID = 'm7-schedule-y';
const MODULE_NAME = 'Schedule Y Compliance';

const M7_SAMPLE = `PHASE I FIRST-IN-HUMAN STUDY PROTOCOL — BX-500 (Novel JAK Inhibitor)
Sponsor: BioXcel Therapeutics India Pvt. Ltd.
Study Type: Phase I, open-label, dose-escalation FIH study
Indication: Rheumatoid Arthritis

COMPLETED: Genotoxicity studies (negative), Central Ethics Committee approval,
Study objectives and design, Dose escalation criteria with sentinel dosing,
SAE reporting procedures per NDCTR 2019

NOT COMPLETED/MISSING: Reproductive toxicity studies (dog study ongoing),
Local ethics committee approvals (3 of 4 sites pending), Insurance documentation,
Hindi informed consent form, Final Statistical Analysis Plan,
Formal DSMB for novel mechanism FIH study, Carcinogenicity studies`;

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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE','HIGH','STRONG','YES'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE','MINOR NON-COMPLIANCE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

const validateInput = (text: string, minWords: number = 20): string | null => {
  if (!text || !text.trim()) return 'Please enter or upload a document before running.';
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < minWords) return `Please provide more content — minimum ${minWords} words required (currently ${wordCount} words).`;
  if (wordCount > 8000) return 'Document too long — please limit to 8,000 words for best results.';
  return null;
};

export default function ScheduleYChecker() {
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
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

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

  const handleRestore = (entry: HistoryEntry) => { setResult(entry.result); };

  const runCheck = async () => {
    const validationError = validateInput(text);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setLoading(true);
    try {
      const response = await runScheduleYCompliance(text);
      const res = response?.data?.result || response?.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      console.error('Schedule Y check failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Schedule Y lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Schedule Y / CDSCO compliance check</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Perform a deep compliance review against Schedule Y and NDCTR 2019, identifying
              compliant areas, findings, and priority actions with estimated remediation effort.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">Schedule Y</span>
            <span className="status-chip">NDCTR 2019</span>
            <span className="status-chip">CDSCO</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>{status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}</span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
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
          <button
            onClick={() => { setText(M7_SAMPLE); setError(null); }}
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
          placeholder="Paste the document text to check against Schedule Y and CDSCO requirements."
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
            Returns compliance evaluation, findings, compliant areas, and priority actions.
          </p>
          <button type="button" className="primary-button" onClick={runCheck} disabled={loading || !text.trim()}>
            {loading ? 'Checking...' : 'Run Schedule Y check'}
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
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          {result._metadata && (
            <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${
              result._metadata.confidence_level === 'HIGH' ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : result._metadata.confidence_level === 'MEDIUM' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
              <span className="ml-auto text-slate-500 font-normal">{result._metadata.reviewed_by}</span>
            </div>
          )}

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              Schedule Y Compliance Report
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.submission_readiness)}`} style={{ padding: '4px 12px' }}>
                  Readiness: {safeRender(result.submission_readiness)}
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.overall_compliance_status)}`} style={{ padding: '4px 12px' }}>
                  Status: {safeRender(result.overall_compliance_status)}
                </span>
              </div>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-indigo-400 uppercase font-bold mb-1">Score</div>
              <div className="text-2xl font-bold text-indigo-300">
                {safeRender(result.compliance_score)}<span className="text-base text-indigo-400/70 ml-1">/ {safeRender(result.compliance_percentage)}%</span>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-red-400 uppercase font-bold mb-1">Critical Gaps</div>
              <div className="text-2xl font-bold text-red-300">
                {Array.isArray(result.critical_non_compliances) ? result.critical_non_compliances.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-amber-400 uppercase font-bold mb-1">Major Gaps</div>
              <div className="text-2xl font-bold text-amber-300">
                {Array.isArray(result.major_non_compliances) ? result.major_non_compliances.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Regulatory Risk</div>
              <div className={`text-xl font-bold ${statusColor(result.regulatory_risk)}`} style={{ background: 'transparent' }}>
                {safeRender(result.regulatory_risk)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {Array.isArray(result.strengths) && result.strengths.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Strengths</div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ul className="space-y-2 text-sm text-emerald-200/90">
                    {result.strengths.map((item: string, i: number) => (
                      <li key={i} className="flex gap-2 items-start"><span className="text-emerald-500">✓</span>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recommendations</div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <ul className="space-y-2 text-sm text-blue-200/90">
                    {result.recommendations.map((item: string, i: number) => (
                      <li key={i} className="flex gap-2 items-start"><span className="text-blue-500">→</span>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {(Array.isArray(result.critical_non_compliances) && result.critical_non_compliances.length > 0 || Array.isArray(result.major_non_compliances) && result.major_non_compliances.length > 0 || Array.isArray(result.minor_non_compliances) && result.minor_non_compliances.length > 0) && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Identified Gaps</div>
              <div className="space-y-3">
                {Array.isArray(result.critical_non_compliances) && result.critical_non_compliances.map((item: string, i: number) => (
                  <div key={`crit-${i}`} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-red-300 bg-red-500/20 mt-0.5 whitespace-nowrap">CRITICAL</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.major_non_compliances) && result.major_non_compliances.map((item: string, i: number) => (
                  <div key={`maj-${i}`} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-300 bg-amber-500/20 mt-0.5 whitespace-nowrap">MAJOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.minor_non_compliances) && result.minor_non_compliances.map((item: string, i: number) => (
                  <div key={`min-${i}`} className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-yellow-200 bg-yellow-300/20 mt-0.5 whitespace-nowrap">MINOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.compliance_checklist) && result.compliance_checklist.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Detailed Checklist</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-24">Section</th>
                      <th className="px-4 py-3 font-semibold">Requirement</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Finding / Corrective Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.compliance_checklist.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-200">
                          <RegulationCitation citation={safeRender(item.section)} className="text-slate-200" />
                        </td>
                        <td className="px-4 py-3 text-xs leading-relaxed max-w-xs">{safeRender(item.requirement)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(item.status)}`}>{safeRender(item.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-sm">
                          <div className="mb-1">{safeRender(item.finding)}</div>
                          {item.corrective_action && (
                            <div className="text-amber-300/80 mt-1 flex gap-1 items-start">
                              <span className="font-bold">CAPA:</span><span>{safeRender(item.corrective_action)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
              </div>
            </div>
          )}

          <AIDisclaimer />
          <OutputActions
            result={result}
            moduleName={MODULE_NAME}
            moduleId={MODULE_ID}
            inputSnippet={text.substring(0, 150)}
            pipeableContent={`Schedule Y Status: ${result.overall_status}\nScore: ${result.compliance_score}/10\nGaps: ${(result.gaps || []).join(', ')}\nRecommendations: ${(result.recommendations || []).join(', ')}`}
            pipeableLabel="compliance results"
            textContent={
              `RegCheck-India — ${MODULE_NAME} Result\n` +
              `Generated: ${new Date().toLocaleString()}\n\n` +
              `Status: ${result.overall_compliance_status || ''}\n` +
              `Score: ${result.compliance_score || ''} (${result.compliance_percentage || ''})\n` +
              `Regulatory Risk: ${result.regulatory_risk || ''}\n` +
              `Submission Readiness: ${result.submission_readiness || ''}\n\n` +
              `Critical: ${(result.critical_non_compliances || []).join('; ')}\n` +
              `Recommendations: ${(result.recommendations || []).join('; ')}`
            }
          />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  );
}
