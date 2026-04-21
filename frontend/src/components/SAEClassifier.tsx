'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runCaseClassifier } from '@/services/api';

const severityAccent: Record<string, string> = {
  DEATH: '#ff8aa1',
  LIFE_THREATENING: '#ffb26b',
  HOSPITALISATION: '#ffd166',
  DISABILITY: '#9ad1ff',
  CONGENITAL_ANOMALY: '#79e1d6',
  OTHER: '#d8e5f3',
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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

export default function SAEClassifier() {
  const [text, setText] = useState('');
  const [classification, setClassification] = useState<any>(null);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const classificationResponse = await runCaseClassifier(text);
      setClassification(classificationResponse.result);
    } finally {
      setLoading(false);
    }
  };

  const category = classification?.primary_category || 'OTHER';
  const accent = severityAccent[category] || severityAccent.OTHER;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Safety triage</div>
            <h3 className="mt-3 text-2xl font-semibold">SAE classifier and duplicate review</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Classify seriousness, surface duplicate risk, and generate a clearer queueing signal for reviewers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">WHO-UMC</span>
            <span className="status-chip">Duplicate signals</span>
            <span className="status-chip">Priority scoring</span>
          </div>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the SAE narrative, onset details, suspect product, outcome, and reporter summary."
        />

        <div className="mt-5 flex justify-end">
          <button type="button" className="primary-button" onClick={run} disabled={loading || !text.trim()}>
            {loading ? 'Classifying...' : 'Classify SAE'}
          </button>
        </div>
      </div>

      {(classification || duplicate) && (
        <div className="space-y-6">
          {classification && (
            <div className="glass-panel p-6">
              <ModelAttributionBadge attribution={classification?.model_attribution} />

              <div className="border-b border-white/10 pb-4 mb-6 mt-4">
                <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  Case Classification
                  <div className="flex items-center gap-2">
                    <span className="status-chip text-sm font-normal normal-case">{safeRender(classification.primary_category)}</span>
                    <span className="status-chip text-sm font-normal normal-case">Priority: {safeRender(classification.priority_score)}/10</span>
                    <span className={`status-chip text-sm font-medium ${classification.requires_expedited_reporting ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-white/5'}`} style={{ padding: '4px 12px' }}>
                      {classification.requires_expedited_reporting ? 'EXPEDITED REPORTING REQUIRED' : 'ROUTINE REPORTING'}
                    </span>
                  </div>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Classification Overview</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div>
                      <div className="text-xs text-slate-400">Primary Category</div>
                      <div className="text-2xl font-bold mt-1 text-slate-100">{safeRender(classification.primary_category)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400">Confidence</div>
                        <div className="text-lg font-semibold mt-1">{safeRender(classification.confidence)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Priority Score</div>
                        <div className="text-lg font-semibold mt-1">{safeRender(classification.priority_score)} / 10</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Expedited Reporting</div>
                      <div className="text-lg font-semibold mt-1">{classification.requires_expedited_reporting ? 'YES' : 'NO'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Seriousness Criteria</div>
                  <div className="flex flex-col gap-2">
                    {Array.isArray(classification.seriousness_criteria)
                      ? <div className="flex flex-wrap gap-2">{classification.seriousness_criteria.map((item: string, i: number) => <span key={i} className="status-chip text-red-300 bg-red-400/10">{safeRender(item)}</span>)}</div>
                      : Object.entries(classification.seriousness_criteria || {}).map(([key, value]) => (
                          <div key={key} className="flex gap-2 text-sm text-slate-300 w-full justify-between border-b border-white/5 pb-1">
                            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className={value ? 'text-red-400 font-medium' : 'text-slate-500'}>
                              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeRender(value)}
                            </span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>

              {classification.causality && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Causality Assessment</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`status-chip font-bold ${statusColor(classification.causality.assessment)}`}>{safeRender(classification.causality.assessment)}</span>
                      <span className="text-sm text-slate-400">WHO-UMC Category:</span>
                      <span className="text-sm font-semibold text-slate-200">{safeRender(classification.causality.who_umc_category)}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">{safeRender(classification.causality.rationale)}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {Object.entries(classification.causality).filter(([k]) => !['assessment','who_umc_category','rationale'].includes(k)).map(([key, value]) => (
                        <div key={key} className="border-t border-white/5 pt-2 text-slate-300">
                          <span className="capitalize text-slate-400 block text-xs mb-1">{key.replace(/_/g, ' ')}</span>
                          <span>{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {classification.reporting_timeline && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Reporting Timeline</div>
                    <div className="rounded-xl border-l-2 border-indigo-500 bg-white/5 p-4 space-y-3">
                      {Object.entries(classification.reporting_timeline).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className="text-sm mt-0.5 text-slate-200">{safeRender(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {classification.product_relatedness && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Product Relatedness</div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                      {Object.entries(classification.product_relatedness).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="capitalize text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-slate-200">{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {Array.isArray(classification.flags) && classification.flags.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Flags</div>
                  <div className="flex flex-wrap gap-2">
                    {classification.flags.map((flag: string, i: number) => (
                      <span key={i} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                        {safeRender(flag)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(classification.regulatory_actions_required) && classification.regulatory_actions_required.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory Actions Required</div>
                  <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-amber-200">
                      {classification.regulatory_actions_required.map((action: string, i: number) => (
                        <li key={i} className="pl-1 leading-relaxed">{safeRender(action)}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {classification.case_quality_assessment && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Case Quality Assessment</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(classification.case_quality_assessment).map(([key, value]) => (
                        <div key={key} className="rounded border border-white/5 bg-slate-800/50 p-2">
                          <div className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className="text-slate-200 mt-1">{safeRender(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {classification.expedited_reporting_requirements && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Expedited Reporting Requirements</div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                      {Object.entries(classification.expedited_reporting_requirements).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="capitalize text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-slate-200">{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {classification.audit_log && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                    <span>{safeRender(classification.audit_log.timestamp)}</span>
                    <span>•</span>
                    <span className={statusColor(classification.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                      {safeRender(classification.audit_log.status)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicate && (
            <div className="glass-panel p-6">
              <div className="metric-label">Duplicate review</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="metric-card">
                  <div className="metric-label">Recommendation</div>
                  <div className="metric-value text-xl">{safeRender(duplicate.recommendation || 'NA')}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Potential duplicates</div>
                  <div className="metric-value">{safeRender(duplicate.duplicate_count ?? 0)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
