'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runInspectionReportGenerator } from '@/services/api';

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

export default function InspectionReportGenerator() {
  const [text, setText] = useState('');
  const [facilityType, setFacilityType] = useState('manufacturing');
  const [result, setResult] = useState<any>(null);
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

  const runGeneration = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runInspectionReportGenerator(text, {
        facility_type: facilityType,
      });
      setResult(response.result);
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
              Transform raw inspection findings into a structured CDSCO-style report with
              observations, CAPA plan, and overall compliance rating.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">CDSCO</span>
            <span className="status-chip">CAPA</span>
            <span className="status-chip">GMP</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Facility type</label>
          <select
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400/50 focus:outline-none [&>option]:bg-slate-900"
          >
            <option value="manufacturing">Manufacturing Site</option>
            <option value="clinical_site">Clinical Trial Site</option>
            <option value="laboratory">Testing Laboratory</option>
            <option value="warehouse">Storage / Warehouse</option>
          </select>
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
          placeholder="Paste raw inspection findings, audit observations, or field notes here."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Returns a structured report with observations, CAPA plan, and compliance rating.
          </p>
          <button type="button" className="primary-button" onClick={runGeneration} disabled={loading || !text.trim()}>
            {loading ? 'Generating report...' : 'Generate inspection report'}
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
              Inspection Report
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 font-normal">{safeRender(result.site_name || 'N/A')} · {safeRender(result.inspection_date || 'N/A')}</span>
                <span className={`status-chip text-sm normal-case font-medium ${ratingColor(result.overall_compliance_rating || result.overall_rating)}`} style={{ padding: '4px 12px' }}>
                  Overall Rating: {safeRender(result.overall_compliance_rating || result.overall_rating)}
                </span>
              </div>
            </h2>
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Executive Summary</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-200 leading-relaxed">
                {safeRender(result.executive_summary)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-rose-400 uppercase font-bold mb-1">Critical</div>
              <div className="text-2xl font-bold text-rose-300">
                {result.findings_count?.critical ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'critical').length : 0)}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-amber-400 uppercase font-bold mb-1">Major</div>
              <div className="text-2xl font-bold text-amber-300">
                {result.findings_count?.major ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'major').length : 0)}
              </div>
            </div>
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-yellow-300 uppercase font-bold mb-1">Minor</div>
              <div className="text-2xl font-bold text-yellow-200">
                {result.findings_count?.minor ?? (Array.isArray(result.observations) ? result.observations.filter((o:any) => o.severity?.toLowerCase() === 'minor').length : 0)}
              </div>
            </div>
            <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-blue-400 uppercase font-bold mb-1">Observations</div>
              <div className="text-2xl font-bold text-blue-300">
                {Array.isArray(result.observations) ? result.observations.length : 0}
              </div>
            </div>
          </div>

          {Array.isArray(result.compliance_areas) && result.compliance_areas.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Compliance Areas</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.compliance_areas.map((area: any, i: number) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-300 font-medium">{safeRender(area.area || area.name || area)}</span>
                    <span className={`status-chip text-xs ${statusColor(area.status || area.rating || 'N/A')}`}>
                      {safeRender(area.status || area.rating || 'N/A')}
                    </span>
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
                    <tr>
                      <th className="px-4 py-3 font-semibold w-16">ID</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Regulatory Ref</th>
                      <th className="px-4 py-3 font-semibold">Corrective Action</th>
                      <th className="px-4 py-3 font-semibold">Deadline</th>
                    </tr>
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
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}`}>{safeRender(obs.severity)}</span>
                          </td>
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
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory References</div>
              <div className="flex flex-wrap gap-2">
                {result.regulatory_references.map((ref: any, i: number) => (
                  <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {safeRender(ref)}
                  </span>
                ))}
              </div>
            </div>
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
                    <span className={`status-chip ${result.re_inspection_required || result.follow_up_required ? 'text-red-300 bg-red-400/10' : 'text-emerald-300 bg-emerald-400/10'}`}>
                      {result.re_inspection_required || result.follow_up_required ? 'YES' : 'NO'}
                    </span>
                  </div>
                  {result.follow_up_date && (
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-sm text-slate-400">Follow-up Date</span>
                      <span className="text-sm font-bold text-slate-200">{safeRender(result.follow_up_date)}</span>
                    </div>
                  )}
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
