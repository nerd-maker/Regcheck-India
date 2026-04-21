'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runCompletenessAssessor } from '@/services/api';

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

export default function CompletenessAssessor() {
  const [text, setText] = useState('');
  const [docType, setDocType] = useState('clinical_protocol');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAssessment = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await runCompletenessAssessor(text, {
        document_type: docType,
      });
      setResult(response.result);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const style =
      status === 'COMPLETE'
        ? 'bg-emerald-400/20 text-emerald-300'
        : status === 'INCOMPLETE'
        ? 'bg-rose-400/20 text-rose-300'
        : 'bg-amber-400/20 text-amber-300';
    return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${style}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Completeness lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Submission completeness assessment</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y,
              NDCTR 2019, and ICH requirements. Surfaces missing sections, data gaps, and submission
              readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">CDSCO</span>
            <span className="status-chip">Schedule Y</span>
            <span className="status-chip">NDCTR 2019</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400/50 focus:outline-none [&>option]:bg-slate-900"
          >
            <option value="clinical_protocol">Clinical Protocol</option>
            <option value="icf">Informed Consent Form</option>
            <option value="csr">Clinical Study Report</option>
            <option value="ib">Investigator Brochure</option>
            <option value="ctri">CTRI Registration</option>
            <option value="sugam_application">SUGAM Application</option>
          </select>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full submission document text here for completeness evaluation."
        />

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

      {error && (
        <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

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

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>{safeRender(result.audit_log.sections_checked)} sections checked</span>
                <span>•</span>
                <span>{safeRender(result.audit_log.sections_passed)} passed</span>
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
