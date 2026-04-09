'use client';

import React, { useState } from 'react';
import AnonymisationTool from '@/components/AnonymisationTool';
import ChangeMonitorDashboard from '@/components/ChangeMonitorDashboard';
import DocumentComparator from '@/components/DocumentComparator';
import DocumentGenerator from '@/components/DocumentGenerator';
import DocumentSummariser from '@/components/DocumentSummariser';
import DocumentUpload from '@/components/DocumentUpload';
import MetadataForm from '@/components/MetadataForm';
import QueryResponseAssistant from '@/components/QueryResponseAssistant';
import ResultsViewer from '@/components/ResultsViewer';
import SAEClassifier from '@/components/SAEClassifier';
import { api, DocumentMetadata, EvaluationResponse } from '@/services/api';

type Module =
  | 'compliance'
  | 'generator'
  | 'query'
  | 'regulatory'
  | 'anonymise'
  | 'summarise'
  | 'comparator'
  | 'classifier';

type ModuleCard = {
  id: Module;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  accent: string;
  category: string;
};

const modules: ModuleCard[] = [
  {
    id: 'compliance',
    name: 'Compliance Command',
    shortName: 'M1',
    icon: '01',
    description: 'Evaluate submissions against Indian regulatory expectations with structured findings and remediation guidance.',
    accent: '#5bc0be',
    category: 'Core review',
  },
  {
    id: 'generator',
    name: 'Document Studio',
    shortName: 'M2',
    icon: '02',
    description: 'Generate protocol-grade documentation with inline regulatory structure and reviewer-ready sections.',
    accent: '#ffd166',
    category: 'Drafting',
  },
  {
    id: 'query',
    name: 'Query Desk',
    shortName: 'M3',
    icon: '03',
    description: 'Draft response packages for CDSCO deficiency letters with better consistency and traceability.',
    accent: '#ff8f5a',
    category: 'Response',
  },
  {
    id: 'regulatory',
    name: 'Intelligence Radar',
    shortName: 'M4',
    icon: '04',
    description: 'Monitor regulatory movement, triage impact, and keep active submissions aligned with policy drift.',
    accent: '#9ad1ff',
    category: 'Monitoring',
  },
  {
    id: 'anonymise',
    name: 'Privacy Shield',
    shortName: 'M5',
    icon: '05',
    description: 'Run DPDP and NDHM-aligned anonymisation workflows with auditability and structured outputs.',
    accent: '#79e1d6',
    category: 'Privacy',
  },
  {
    id: 'summarise',
    name: 'Summary Engine',
    shortName: 'M6',
    icon: '06',
    description: 'Turn dense SUGAM, SAE, and meeting inputs into concise reviewer-friendly structured summaries.',
    accent: '#ffb26b',
    category: 'Synthesis',
  },
  {
    id: 'comparator',
    name: 'Comparison Lab',
    shortName: 'M7',
    icon: '07',
    description: 'Inspect version drift, completeness, and substantive regulatory changes in one view.',
    accent: '#f5d76e',
    category: 'Diffing',
  },
  {
    id: 'classifier',
    name: 'SAE Triage',
    shortName: 'M8',
    icon: '08',
    description: 'Classify safety events, surface likely duplicates, and prioritize the reviewer queue.',
    accent: '#ff8aa1',
    category: 'Safety',
  },
];

const complianceStats = [
  { label: 'Review modes', value: '8 modules' },
  { label: 'Core legal stack', value: 'CDSCO + ICH' },
  { label: 'Runtime posture', value: 'Session-aware' },
];

export default function Home() {
  const [activeModule, setActiveModule] = useState<Module>('compliance');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata>({
    document_type: '',
    sponsor_name: '',
    drug_name: '',
    inn: '',
    trial_phase: '',
    submission_target: '',
    version: '',
    date: '',
  });
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const activeModuleMeta = modules.find((module) => module.id === activeModule) ?? modules[0];

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setFileId(null);
    setEvaluation(null);
    setError(null);
    setUploadProgress('Uploading document...');

    try {
      const response = await api.uploadDocument(file);
      setFileId(response.file_id);
      setUploadProgress('Document uploaded and staged for evaluation.');
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload document');
      setUploadProgress('');
    }
  };

  const handleEvaluate = async () => {
    if (!fileId) {
      setError('Please upload a document first.');
      return;
    }

    if (
      !metadata.document_type ||
      !metadata.sponsor_name ||
      !metadata.drug_name ||
      !metadata.trial_phase ||
      !metadata.submission_target
    ) {
      setError('Please fill in all required metadata fields before running evaluation.');
      return;
    }

    setLoading(true);
    setError(null);
    setEvaluation(null);

    try {
      const result = await api.evaluateDocument(fileId, metadata);
      setEvaluation(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to evaluate document');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileId(null);
    setMetadata({
      document_type: '',
      sponsor_name: '',
      drug_name: '',
      inn: '',
      trial_phase: '',
      submission_target: '',
      version: '',
      date: '',
    });
    setEvaluation(null);
    setError(null);
    setUploadProgress('');
  };

  return (
    <div className="app-shell">
      <div className="relative z-10">
        <header className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 lg:px-8">
          <div className="glass-panel-strong overflow-hidden p-6 md:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-5">
                <span className="section-kicker">Regulatory Operating System</span>
                <div className="space-y-3">
                  <h1 className="text-balance text-4xl font-semibold md:text-5xl">
                    RegCheck-India
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                    A sharper control surface for Indian pharmaceutical compliance work, from
                    protocol review and query drafting to anonymisation, summarisation, comparison,
                    and SAE triage.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="status-chip">India sovereign AI stack</span>
                  <span className="status-chip">Session-aware workflows</span>
                  <span className="status-chip">CDSCO and ICH aligned</span>
                </div>
              </div>

              <div className="grid min-w-full gap-4 sm:grid-cols-3 lg:min-w-[360px]">
                {complianceStats.map((stat) => (
                  <div key={stat.label} className="metric-card">
                    <div className="metric-label">{stat.label}</div>
                    <div className="metric-value">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <section className="glass-panel mb-8 p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="section-kicker">Module Grid</div>
                <h2 className="section-title mt-3">Switch between review lanes</h2>
              </div>
              <p className="section-copy max-w-2xl">
                The interface is organized like a regulatory control room: pick a lane, see the
                active mission clearly, and keep every output tied to the same session context.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => {
                const isActive = activeModule === module.id;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setActiveModule(module.id)}
                    className={`module-card ${isActive ? 'module-card-active' : ''}`}
                    style={{
                      boxShadow: isActive ? `0 16px 42px ${module.accent}22` : undefined,
                    }}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold"
                        style={{
                          borderColor: `${module.accent}55`,
                          backgroundColor: `${module.accent}22`,
                          color: module.accent,
                        }}
                      >
                        {module.icon}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          backgroundColor: `${module.accent}20`,
                          color: module.accent,
                        }}
                      >
                        {module.shortName}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {module.category}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-50">{module.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{module.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass-panel-strong overflow-hidden">
            <div className="border-b border-white/10 px-6 py-5 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div
                    className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{
                      backgroundColor: `${activeModuleMeta.accent}1f`,
                      color: activeModuleMeta.accent,
                    }}
                  >
                    {activeModuleMeta.shortName} active
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{activeModuleMeta.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    {activeModuleMeta.description}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="metric-card min-w-[180px]">
                    <div className="metric-label">Current lane</div>
                    <div className="metric-value text-xl">{activeModuleMeta.category}</div>
                  </div>
                  <div className="metric-card min-w-[180px]">
                    <div className="metric-label">Status</div>
                    <div className="metric-value text-xl">Ready to run</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 md:px-8 md:py-8">
              {activeModule === 'compliance' && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="glass-panel p-6">
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <div className="section-kicker">Step 1</div>
                          <h3 className="mt-3 text-xl font-semibold">Upload and stage the source file</h3>
                        </div>
                        <span className="status-chip">PDF or DOCX</span>
                      </div>
                      <DocumentUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
                      {uploadProgress && (
                        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                          {uploadProgress}
                        </div>
                      )}
                    </div>

                    <div className="glass-panel p-6">
                      <div className="section-kicker">Review note</div>
                      <h3 className="mt-3 text-xl font-semibold">Keep human oversight in the loop</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        This workspace accelerates review, but filing decisions should still be made
                        by qualified regulatory professionals.
                      </p>
                      <div className="mt-6 grid gap-4">
                        <div className="metric-card">
                          <div className="metric-label">Evaluation basis</div>
                          <div className="metric-value text-xl">NDCTR 2019</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Supporting frame</div>
                          <div className="metric-value text-xl">CDSCO, Schedule Y, CTRI</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Workflow mode</div>
                          <div className="metric-value text-xl">Upload, map, evaluate</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {fileId && (
                    <div className="glass-panel p-6">
                      <div className="mb-4">
                        <div className="section-kicker">Step 2</div>
                        <h3 className="mt-3 text-xl font-semibold">Document metadata</h3>
                      </div>
                      <MetadataForm metadata={metadata} onChange={setMetadata} />
                    </div>
                  )}

                  {fileId && (
                    <div className="glass-panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="section-kicker">Step 3</div>
                        <h3 className="mt-3 text-xl font-semibold">Run compliance evaluation</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Launch the evaluator once the source file and filing metadata are in place.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleEvaluate}
                          disabled={loading}
                          className={`primary-button ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          {loading ? 'Evaluating...' : 'Evaluate document'}
                        </button>
                        <button type="button" onClick={handleReset} className="secondary-button">
                          Reset workspace
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
                      {error}
                    </div>
                  )}

                  {evaluation && <ResultsViewer evaluation={evaluation} />}
                </div>
              )}

              {activeModule === 'generator' && <DocumentGenerator />}
              {activeModule === 'query' && <QueryResponseAssistant />}
              {activeModule === 'regulatory' && <ChangeMonitorDashboard />}
              {activeModule === 'anonymise' && <AnonymisationTool />}
              {activeModule === 'summarise' && <DocumentSummariser />}
              {activeModule === 'comparator' && <DocumentComparator />}
              {activeModule === 'classifier' && <SAEClassifier />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
