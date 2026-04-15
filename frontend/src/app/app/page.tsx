'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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

type SidebarItem = {
  id: string;
  label: string;
  module?: Module;
  icon: React.ReactNode;
};

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    module: 'compliance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'submissions',
    label: 'Submissions',
    module: 'generator',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'audit-trails',
    label: 'Audit Trails',
    module: 'anonymise',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'compliance-tracking',
    label: 'Compliance Tracking',
    module: 'compliance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'regulatory-intelligence',
    label: 'Regulatory Intelligence',
    module: 'regulatory',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'product-catalog',
    label: 'Product Catalog',
    module: 'summarise',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'document-archive',
    label: 'Document Archive',
    module: 'comparator',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

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
  const [activeSidebar, setActiveSidebar] = useState('regulatory-intelligence');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleSidebarClick = (item: SidebarItem) => {
    setActiveSidebar(item.id);
    if (item.module) {
      setActiveModule(item.module);
    }
    setSidebarOpen(false);
  };

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
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-[60] lg:hidden w-10 h-10 bg-primary/90 backdrop-blur rounded-lg flex items-center justify-center text-white shadow-lg"
      >
        {sidebarOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Fixed left sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 w-72 h-screen flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#00113a' }}
      >
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/10 flex items-center justify-center rounded-lg">
              <span className="text-white font-black text-base">R</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              RegCheck<span className="text-secondary-fixed-dim">-India</span>
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = activeSidebar === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'border-l-4 border-secondary bg-secondary-fixed/10 text-secondary-fixed-dim ml-0 pl-3'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">
              RA
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">RA Professional</div>
              <div className="text-xs text-slate-400 truncate">regcheck.india@gmail.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:ml-72 relative z-10">
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
                  <span className="status-chip">Anthropic Claude stack</span>
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


