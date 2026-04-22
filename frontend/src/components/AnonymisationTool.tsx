'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runPIIAnonymiser } from '@/services/api';

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

export default function AnonymisationTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'pseudo' | 'full'>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setText(extractedText);
    setUploadError(null);
  };

  const handleUploadError = (uploadMessage: string) => {
    setUploadError(uploadMessage);
  };

  const runAnonymise = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runPIIAnonymiser(text, { mode: mode === 'full' ? 'full' : 'pseudo', full_anonymisation: mode === 'full' });
      setResult({ ...response.result, mode });
    } catch (err: unknown) {
      console.error('Anonymisation failed:', err);
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
            <span className="status-chip">Audit-ready</span>
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
        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste patient narratives, site details, or investigator notes here."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Structured reports will show entity counts, legal frameworks, and audit log summaries.
          </p>
          <button type="button" className="primary-button" onClick={runAnonymise} disabled={loading || !text.trim()}>
            {loading ? 'Processing...' : 'Run anonymisation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Request Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            If the server is starting up, wait 30 seconds and try again. 
            Free tier servers sleep after 15 minutes of inactivity.
          </div>
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              PII DETECTION & ANONYMISATION
              <div className="flex items-center gap-2">
                <span className="status-chip text-sm normal-case font-medium">
                  {safeRender(result.entities_anonymised)} Entities Removed
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.risk_level || 'LOW')}`} style={{ padding: '4px 12px' }}>
                  Risk: {safeRender(result.risk_level || 'LOW')}
                </span>
              </div>
            </h2>
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
                  <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/4">Entity Type</th>
                      <th className="px-4 py-3 font-semibold w-1/3">Original Value</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
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
                            <span className={`status-chip ${isPHI ? 'text-blue-400 bg-blue-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                              {safeRender(entity.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{safeRender(entity.position)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">PII Removed</div>
                    <div className="mt-1 text-2xl font-bold text-slate-100">{safeRender(result.anonymisation_report.pii_removed)}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">PHI Removed</div>
                    <div className="mt-1 text-2xl font-bold text-slate-100">{safeRender(result.anonymisation_report.phi_removed)}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Clinical Integrity</div>
                    <div className="mt-2">
                      <span className={statusColor(result.anonymisation_report.clinical_integrity)} style={{ padding: '4px 12px', borderRadius: '4px' }}>
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
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>Mode: {safeRender(result.audit_log.mode)}</span>
                <span>•</span>
                <span>Method: {safeRender(result.audit_log.anonymisation_method)}</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
                <span>•</span>
                <span>{safeRender(result.audit_log.entities_processed)} entities processed</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
