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
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            {classification && (
              <div className="glass-panel p-6">
                <ModelAttributionBadge attribution={classification?.model_attribution} />
                <div className="mt-5 rounded-[28px] border p-5" style={{ borderColor: `${accent}55`, backgroundColor: `${accent}14` }}>
                  <div className="metric-label">Primary severity</div>
                  <div className="mt-3 text-3xl font-semibold" style={{ color: accent }}>
                    {category}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="status-chip">Priority {safeRender(classification.priority_score ?? 'NA')}</span>
                    <span className="status-chip">{safeRender(classification.reporting_timeline?.timeline || classification.reporting_timeline?.status || classification.reporting_timeline?.assessment || 'Timeline pending')}</span>
                    <span className="status-chip">{safeRender(classification.causality?.assessment || classification.causality?.who_umc_category || 'Causality pending')}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Rationale</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {safeRender(classification.classification_rationale || 'No rationale returned.')}
                    </p>
                  </div>

                  {classification.seriousness_criteria && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Triggered seriousness criteria</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.isArray(classification.seriousness_criteria)
                        ? classification.seriousness_criteria.map((item: string, i: number) => (
                            <span key={i} className="status-chip">{String(item)}</span>
                          ))
                        : Object.entries(classification.seriousness_criteria || {}).map(([key, value]) => (
                            <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                              <span className="capitalize w-48">{key.replace(/_/g, ' ')}</span>
                              <span className={value ? 'text-error font-medium' : 'text-slate-500'}>
                                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                              </span>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                  )}

                  {classification.causality && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Causality</div>
                    <div className="mt-3 flex flex-col gap-1">
                      {Object.entries(classification.causality || {}).map(([key, value]) => (
                        <div key={key} className="text-sm text-slate-300 mb-1">
                          <span className="capitalize text-slate-400">{key.replace(/_/g, ' ')}: </span>
                          <span>
                            {Array.isArray(value)
                              ? value.map((v: unknown, i: number) => <div key={i} className="ml-2">• {safeRender(v)}</div>)
                              : safeRender(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {classification.reporting_timeline && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Reporting Timeline</div>
                    <div className="mt-3 flex flex-col gap-1">
                      {Object.entries(classification.reporting_timeline || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                          <span className="capitalize w-48 text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span>{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {classification.product_relatedness && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Product Relatedness</div>
                    <div className="mt-3 flex flex-col gap-1">
                      {Object.entries(classification.product_relatedness || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                          <span className="capitalize w-48 text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span>{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {classification.expedited_reporting_requirements && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Expedited Reporting Requirements</div>
                    <div className="mt-3 flex flex-col gap-1">
                      {Object.entries(classification.expedited_reporting_requirements || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                          <span className="capitalize w-48 text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span>{safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {classification.case_quality_assessment && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Case Quality Assessment</div>
                    <div className="mt-3 flex flex-col gap-1">
                      {Object.entries(classification.case_quality_assessment || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                          <span className="capitalize w-48 text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span>{Array.isArray(value) ? value.join(', ') : safeRender(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>

                {(classification.secondary_categories || classification.flags || classification.regulatory_actions_required) && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Tags & Actions</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.isArray(classification.secondary_categories) && classification.secondary_categories.map((cat: string, i: number) => (
                        <span key={i} className="status-chip">{safeRender(cat)}</span>
                      ))}
                      {Array.isArray(classification.flags) && classification.flags.map((flag: string, i: number) => (
                        <span key={i} className="status-chip text-error">{safeRender(flag)}</span>
                      ))}
                      {Array.isArray(classification.regulatory_actions_required) && classification.regulatory_actions_required.map((action: string, i: number) => (
                        <span key={i} className="status-chip text-amber-500">{safeRender(action)}</span>
                      ))}
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

          <div className="glass-panel p-6">
            <div className="metric-label">Safety review payload</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {JSON.stringify({ classification, duplicate }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
