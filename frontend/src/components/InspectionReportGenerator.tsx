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
import { runInspectionReportGenerator, extractTextFromFileOCR } from '@/services/api';

const MODULE_ID = 'm5-inspection';
const MODULE_NAME = 'Inspection Report Generator';

const M5_SAMPLE = `GCP INSPECTION FINDINGS - Site 3, KEM Hospital Mumbai
Inspector: Dr. A. Mehta, CDSCO Mumbai Zone | Inspection Date: 15-January-2025
CRITICAL FINDINGS:
1. 7 of 18 active subjects not re-consented for Protocol Amendment v2.0 after 2 months
2. No Quality Management System documented for the trial
3. PI completed only 2 of 6 mandatory GCP training modules
MAJOR FINDINGS:
1. Sub-investigator delegation log not updated - 3 new staff members not listed
2. EDC audit trail: 5 entries missing reason codes for data changes
3. No centralized or risk-based monitoring plan in place
MINOR FINDINGS:
1. Fixed monitoring intervals not adjusted for site performance metrics
2. Previous monitoring visit conducted 6 months ago - excessive interval`;

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

export default function InspectionReportGenerator() {
  const [text, setText] = useState('');
  const [facilityType, setFacilityType] = useState('manufacturing');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'scan' | 'handwritten'>('text');
  const [ocrResult, setOcrResult] = useState<{method: string, confidence: number, warnings: string[]} | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
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

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setText(extractedText);
    setUploadError(null);
    setOcrResult(null);
  };
  const handleUploadError = (uploadMessage: string) => setUploadError(uploadMessage);
  const handleRestore = (entry: HistoryEntry) => setResult(entry.result);

  const runGeneration = async () => {
    const ve = validateInput(text);
    if (ve) { setError(ve); return; }
    setError(null);
    setLoading(true);
    try {
      const response = await runInspectionReportGenerator(text, { facility_type: facilityType });
      const res = response.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, text, res);
    } catch (err: unknown) {
      console.error('Report generation failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const ratingColor = (rating: string) => {
    const r = (rating || '').toLowerCase();
    if (r.includes('compliant') && !r.includes('non')) return 'text-emerald-300';
    if (r.includes('non') || r.includes('critical')) return 'text-rose-300';
    return 'text-amber-300';
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Inspection lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Inspection report generation</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Transform raw inspection findings into a structured CDSCO-style report with observations, CAPA plan, and overall compliance rating.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">CDSCO</span>
            <span className="status-chip">CAPA</span>
            <span className="status-chip">GMP</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>{status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}</span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Facility type</label>
          <select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400/50 focus:outline-none [&>option]:bg-[#0d2037]">
            <option value="manufacturing">Manufacturing Site</option>
            <option value="clinical_site">Clinical Trial Site</option>
            <option value="laboratory">Testing Laboratory</option>
            <option value="warehouse">Storage / Warehouse</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Input Method</label>
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: 'text',
                label: 'Type / Paste Text',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                )
              },
              {
                value: 'scan',
                label: 'Scanned Document (OCR)',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                )
              },
              {
                value: 'handwritten',
                label: 'Handwritten Notes (AI Vision)',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                )
              },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setInputMode(mode.value as 'text' | 'scan' | 'handwritten')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  inputMode === mode.value
                    ? 'bg-teal-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {mode.icon}
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {(inputMode === 'scan' || inputMode === 'handwritten') && (
          <div className="mb-4">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setOcrLoading(true); setError(null); setOcrResult(null);
              try {
                const mode = inputMode === 'handwritten' ? 'vision' : 'auto';
                const result = await extractTextFromFileOCR(file, mode);
                setText(result.extracted_text);
                setOcrResult({ method: result.ocr_method, confidence: result.confidence, warnings: result.warnings });
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'OCR failed');
              } finally { setOcrLoading(false); }
            }} className="hidden" id="ocr-upload" />
            <label htmlFor="ocr-upload" className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm cursor-pointer transition-all ${ocrLoading ? 'border-white/10 text-slate-500 cursor-wait' : 'border-white/20 text-slate-300 hover:border-teal-400/50 hover:text-teal-400'}`}>
              {ocrLoading ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>{inputMode === 'handwritten' ? 'AI reading handwriting...' : 'Scanning document...'}</>) : (<><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>{inputMode === 'handwritten' ? 'Upload handwritten notes (PNG, JPG, PDF)' : 'Upload scanned document (PDF, PNG, JPG, TIFF)'}</>)}
            </label>
            {ocrResult && (<div className="mt-3 space-y-2"><div className="flex items-center gap-3 text-xs"><span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-medium">{ocrResult.method}</span><span className="text-slate-400">Confidence: {Math.round(ocrResult.confidence * 100)}%</span></div>{ocrResult.warnings.length > 0 && (<div className="space-y-1">{ocrResult.warnings.map((w, i) => (<div key={i} className="text-xs text-amber-400 flex items-center gap-1"><span>⚠</span> {w}</div>))}</div>)}</div>)}
          </div>
        )}

        {inputMode === 'text' && (<FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />)}
        {uploadError && <div className="mb-2 flex items-center gap-1 text-xs text-red-400"><span>⚠</span> {uploadError}</div>}
        <div className="flex items-center justify-between mb-2 mt-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</label>
          <button onClick={() => { setText(M5_SAMPLE); setError(null); }} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Load sample data
          </button>
        </div>
        <textarea className="textarea-shell" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} placeholder="Paste raw inspection findings, audit observations, or field notes here." />
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
          <p className="text-sm text-slate-400">Returns a structured report with observations, CAPA plan, and compliance rating.</p>
          <button type="button" className="primary-button" onClick={runGeneration} disabled={loading || !text.trim()}>{loading ? 'Generating report...' : 'Generate inspection report'}</button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">{elapsed < 10 ? 'Sending to AI agent...' : elapsed < 30 ? 'Analysing findings...' : elapsed < 60 ? 'Generating structured report...' : 'Almost done...'}</div>
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
              <span>{result._metadata.confidence_level} CONFIDENCE - {result._metadata.confidence_reason}</span>
            </div>
          )}
          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              Inspection Report
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 font-normal">{safeRender(result.site_name || 'N/A')} · {safeRender(result.inspection_date || 'N/A')}</span>
                <span className={`status-chip text-sm normal-case font-medium ${ratingColor(result.overall_compliance_rating || result.overall_rating)}`} style={{ padding: '4px 12px' }}>Overall Rating: {safeRender(result.overall_compliance_rating || result.overall_rating)}</span>
              </div>
            </h2>
          </div>

          {result.executive_summary && (<div className="mb-6"><div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Executive Summary</div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-200 leading-relaxed">{safeRender(result.executive_summary)}</p></div></div>)}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center"><div className="text-xs text-rose-400 uppercase font-bold mb-1">Critical</div><div className="text-2xl font-bold text-rose-300">{result.findings_count?.critical ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'critical').length : 0)}</div></div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center"><div className="text-xs text-amber-400 uppercase font-bold mb-1">Major</div><div className="text-2xl font-bold text-amber-300">{result.findings_count?.major ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'major').length : 0)}</div></div>
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4 text-center"><div className="text-xs text-yellow-300 uppercase font-bold mb-1">Minor</div><div className="text-2xl font-bold text-yellow-200">{result.findings_count?.minor ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'minor').length : 0)}</div></div>
            <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-4 text-center"><div className="text-xs text-blue-400 uppercase font-bold mb-1">Observations</div><div className="text-2xl font-bold text-blue-300">{Array.isArray(result.observations) ? result.observations.length : 0}</div></div>
          </div>

          {Array.isArray(result.compliance_areas) && result.compliance_areas.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Compliance Areas</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.compliance_areas.map((area: any, i: number) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-300 font-medium">{safeRender(area.area || area.name || area)}</span>
                    <span className={`status-chip text-xs ${statusColor(area.status || area.rating || 'N/A')}`}>{safeRender(area.status || area.rating || 'N/A')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.observations) && result.observations.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Findings Table</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase text-slate-400">
                    <tr><th className="px-4 py-3 font-semibold w-16">ID</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Severity</th><th className="px-4 py-3 font-semibold">Regulatory Ref</th><th className="px-4 py-3 font-semibold">Corrective Action</th><th className="px-4 py-3 font-semibold">Deadline</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.observations.map((obs: any, i: number) => {
                      const sev = (obs.severity || '').toUpperCase();
                      const rowClass = sev === 'CRITICAL' ? 'bg-rose-500/5' : sev === 'MAJOR' ? 'bg-amber-500/5' : 'hover:bg-white/5';
                      const badgeClass = sev === 'CRITICAL' ? 'text-rose-300 bg-rose-500/20' : sev === 'MAJOR' ? 'text-amber-300 bg-amber-500/20' : 'text-yellow-200 bg-yellow-300/20';
                      return (
                        <tr key={i} className={rowClass}>
                          <td className="px-4 py-3 font-mono text-xs">{safeRender(obs.id || i+1)}</td>
                          <td className="px-4 py-3 font-medium text-slate-200">{safeRender(obs.category || obs.title)}</td>
                          <td className="px-4 py-3 text-xs leading-relaxed max-w-xs">{safeRender(obs.finding || obs.description)}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}`}>{safeRender(obs.severity)}</span></td>
                          <td className="px-4 py-3 text-xs">{safeRender(obs.regulatory_reference || obs.reference)}</td>
                          <td className="px-4 py-3 text-xs text-amber-200/80 max-w-xs">{safeRender(obs.corrective_action || obs.capa)}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{safeRender(obs.deadline)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Array.isArray(result.regulatory_references) && result.regulatory_references.length > 0 && (
            <div className="mb-6"><div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory References</div><div className="flex flex-wrap gap-2">{result.regulatory_references.map((ref: any, i: number) => (<span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">{safeRender(ref)}</span>))}</div></div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
            {(result.follow_up_required !== undefined || result.follow_up_date) && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Follow Up</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Re-inspection Required</span>
                    <span className={`status-chip ${result.re_inspection_required || result.follow_up_required ? 'text-red-300 bg-red-400/10' : 'text-emerald-300 bg-emerald-400/10'}`}>{result.re_inspection_required || result.follow_up_required ? 'YES' : 'NO'}</span>
                  </div>
                  {result.follow_up_date && (<div className="flex items-center justify-between border-t border-white/5 pt-3"><span className="text-sm text-slate-400">Follow-up Date</span><span className="text-sm font-bold text-slate-200">{safeRender(result.follow_up_date)}</span></div>)}
                </div>
              </div>
            )}
          </div>

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>Inspector: {safeRender(result.audit_log.inspector || 'System')}</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>{safeRender(result.audit_log.status)}</span>
              </div>
            </div>
          )}

          <AIDisclaimer />
          <OutputActions result={result} moduleName={MODULE_NAME}
            moduleId={MODULE_ID}
            inputSnippet={text.substring(0, 150)}
            pipeableContent={`Inspection Rating: ${result.overall_compliance_rating}\nSite: ${result.site_name}\nMajor Gaps: ${(result.major_gaps || []).join(', ')}\nCritical Findings: ${(result.critical_findings || []).join(', ')}`}
            pipeableLabel="inspection summary"
            textContent={`RegCheck-India - ${MODULE_NAME} Result\nGenerated: ${new Date().toLocaleString()}\n\nSite: ${result.site_name || ''}\nDate: ${result.inspection_date || ''}\nRating: ${result.overall_compliance_rating || ''}\n\nRecommendations: ${(result.recommendations || []).join('; ')}`} />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  );
}