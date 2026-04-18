'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AnonymisationTool from '@/components/AnonymisationTool';
import ApiKeyModal from '@/components/ApiKeyModal';
import CompletenessAssessor from '@/components/CompletenessAssessor';
import DocumentSummariser from '@/components/DocumentSummariser';
import DocumentUpload from '@/components/DocumentUpload';
import ICHGCPChecker from '@/components/ICHGCPChecker';
import InspectionReportGenerator from '@/components/InspectionReportGenerator';
import MetadataForm from '@/components/MetadataForm';
import RegulatoryQA from '@/components/RegulatoryQA';
import ResultsViewer from '@/components/ResultsViewer';
import SAEClassifier from '@/components/SAEClassifier';
import ScheduleYChecker from '@/components/ScheduleYChecker';

// The 8 correct agent modules per agents_router.py
type Module =
  | 'anonymise'    // M1 — PII Anonymiser       → POST /api/v1/agents/anonymise
  | 'summarise'    // M2 — Document Summariser   → POST /api/v1/agents/summarise
  | 'completeness' // M3 — Completeness Assessor → POST /api/v1/agents/completeness
  | 'classifier'   // M4 — Case Classifier       → POST /api/v1/agents/classify
  | 'inspection'   // M5 — Inspection Report Gen → POST /api/v1/agents/inspection-report
  | 'reg-qa'       // M6 — Regulatory Q&A       → POST /api/v1/agents/qa
  | 'schedule-y'   // M7 — Schedule Y Compliance → POST /api/v1/agents/schedule-y
  | 'ich-gcp';     // M8 — ICH E6(R3) GCP Checker→ POST /api/v1/agents/ich-gcp

type SidebarItem = {
  id: string;
  label: string;
  module: Module;
  icon: React.ReactNode;
  divider?: string;
};

const sidebarItems: SidebarItem[] = [
  {
    id: 'm1-anonymise',
    label: 'PII Anonymiser',
    module: 'anonymise',
    divider: 'Privacy & Documents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    id: 'm2-summarise',
    label: 'Document Summariser',
    module: 'summarise',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'm3-completeness',
    label: 'Completeness Assessor',
    module: 'completeness',
    divider: 'Compliance Agents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'm4-classifier',
    label: 'Case Classifier',
    module: 'classifier',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'm5-inspection',
    label: 'Inspection Report Generator',
    module: 'inspection',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'm6-reg-qa',
    label: 'Regulatory Q&A',
    module: 'reg-qa',
    divider: 'Knowledge & Deep Checks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'm7-schedule-y',
    label: 'Schedule Y Compliance',
    module: 'schedule-y',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    id: 'm8-ich-gcp',
    label: 'ICH E6(R3) GCP Checker',
    module: 'ich-gcp',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

type ModuleCard = {
  id: Module;
  name: string;
  shortName: string;
  endpoint: string;
  description: string;
  accent: string;
  category: string;
  isQA?: boolean;
};

// Correct 8 modules per spec — names, endpoints match agents_router.py exactly
const modules: ModuleCard[] = [
  {
    id: 'anonymise',
    name: 'PII Anonymiser',
    shortName: 'M1',
    endpoint: '/api/v1/agents/anonymise',
    description: 'Detect and anonymise patient, investigator, and site identities from regulatory documents per DPDP Act 2023 and CDSCO Schedule Y.',
    accent: '#79e1d6',
    category: 'Privacy',
  },
  {
    id: 'summarise',
    name: 'Document Summariser',
    shortName: 'M2',
    endpoint: '/api/v1/agents/summarise',
    description: 'Generate structured regulatory summaries of CSRs, IBs, protocols, and CDSCO correspondence per ICH E3 and CTD format.',
    accent: '#ffb26b',
    category: 'Synthesis',
  },
  {
    id: 'completeness',
    name: 'Completeness Assessor',
    shortName: 'M3',
    endpoint: '/api/v1/agents/completeness',
    description: 'Evaluate submissions against Form CT-04/05/06 requirements. Flags CRITICAL, MAJOR, and MINOR gaps before CDSCO filing.',
    accent: '#6ee7b7',
    category: 'Assessment',
  },
  {
    id: 'classifier',
    name: 'Case Classifier',
    shortName: 'M4',
    endpoint: '/api/v1/agents/classify',
    description: 'Classify adverse events using ICH E2A seriousness, WHO-UMC causality, and NDCTR 2019 reporting timelines with MedDRA coding.',
    accent: '#ff8aa1',
    category: 'Safety',
  },
  {
    id: 'inspection',
    name: 'Inspection Report Generator',
    shortName: 'M5',
    endpoint: '/api/v1/agents/inspection-report',
    description: 'Generate formal CDSCO GCP inspection reports with CAPA plans, observation classification, and Schedule Y clause citations.',
    accent: '#fca5a5',
    category: 'Reporting',
  },
  {
    id: 'reg-qa',
    name: 'Regulatory Q&A',
    shortName: 'M6',
    endpoint: '/api/v1/agents/qa',
    description: 'Ask questions about NDCTR 2019, Schedule Y, and ICH guidelines. Answers grounded in the regulatory knowledge base.',
    accent: '#93c5fd',
    category: 'Knowledge',
    isQA: true,
  },
  {
    id: 'schedule-y',
    name: 'Schedule Y Compliance',
    shortName: 'M7',
    endpoint: '/api/v1/agents/schedule-y',
    description: 'Deep compliance checks across Schedule Y Appendices I–XI and NDCTR 2019 Rules 1–105 with severity-graded findings.',
    accent: '#fde68a',
    category: 'Compliance',
  },
  {
    id: 'ich-gcp',
    name: 'ICH E6(R3) GCP Checker',
    shortName: 'M8',
    endpoint: '/api/v1/agents/ich-gcp',
    description: 'Full GCP evaluation against ICH E6(R3) including R3-specific QMS and Risk-Based Monitoring gaps, with inspection readiness scoring.',
    accent: '#c4b5fd',
    category: 'GCP',
  },
];

export default function AppWorkspace() {
  const [activeModule, setActiveModule] = useState<Module>('anonymise');
  const [activeSidebar, setActiveSidebar] = useState('m1-anonymise');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // On mount: check if a key is already stored
  useEffect(() => {
    const stored = localStorage.getItem('regcheck_anthropic_key');
    if (stored) {
      setHasApiKey(true);
    } else {
      setShowKeyModal(true); // auto-open on first visit
    }
  }, []);

  const handleKeySaved = (key: string) => {
    setHasApiKey(!!key);
    setShowKeyModal(false);
  };

  const maskedKey = (() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('regcheck_anthropic_key') : null;
    if (!stored) return 'No key set';
    return stored.slice(0, 10) + '···' + stored.slice(-4);
  })();

  const activeModuleMeta = modules.find((m) => m.id === activeModule) ?? modules[0];

  const handleSidebarClick = (item: SidebarItem) => {
    setActiveSidebar(item.id);
    setActiveModule(item.module);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      {/* API Key Modal — auto-shows if no key, or when settings clicked */}
      {showKeyModal && (
        <ApiKeyModal
          onKeySaved={handleKeySaved}
          isChanging={hasApiKey}
          onClose={hasApiKey ? () => setShowKeyModal(false) : undefined}
        />
      )}
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

        {/* Nav items — 8 correct agents */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = activeSidebar === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.divider && (
                  <div className="px-4 pt-5 pb-2 first:pt-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      {item.divider}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSidebarClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left leading-tight transition-all ${
                    isActive
                      ? 'border-l-4 border-secondary bg-secondary-fixed/10 text-secondary-fixed-dim ml-0 pl-3'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Bottom section — API key status + settings */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          {/* Key status indicator */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: hasApiKey ? 'rgba(110,231,183,0.08)' : 'rgba(248,113,113,0.08)' }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: hasApiKey ? '#6ee7b7' : '#f87171' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hasApiKey ? '#6ee7b7' : '#f87171' }}>
                {hasApiKey ? 'API Key Active' : 'No API Key'}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono">{maskedKey}</div>
            </div>
          </div>
          {/* Settings button */}
          <button
            id="api-key-settings-btn"
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            {hasApiKey ? 'Change API Key' : 'Set API Key'}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:ml-72 relative z-10">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Active module header bar */}
          <div className="glass-panel-strong overflow-hidden">
            <div className="flex flex-col gap-4 px-6 py-5 md:px-8 md:flex-row md:items-center md:justify-between border-b border-white/10">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
                  style={{
                    backgroundColor: `${activeModuleMeta.accent}22`,
                    color: activeModuleMeta.accent,
                    border: `1px solid ${activeModuleMeta.accent}44`,
                  }}
                >
                  {activeModuleMeta.shortName}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">{activeModuleMeta.name}</h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {activeModuleMeta.description.slice(0, 90)}...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: `${activeModuleMeta.accent}1f`,
                    color: activeModuleMeta.accent,
                  }}
                >
                  {activeModuleMeta.category}
                </div>
                <span className="status-chip">Ready</span>
              </div>
            </div>

            {/* Module content */}
            <div className="px-6 py-6 md:px-8 md:py-8">
              {activeModule === 'anonymise' && <AnonymisationTool />}
              {activeModule === 'summarise' && <DocumentSummariser />}
              {activeModule === 'completeness' && <CompletenessAssessor />}
              {activeModule === 'classifier' && <SAEClassifier />}
              {activeModule === 'inspection' && <InspectionReportGenerator />}
              {activeModule === 'reg-qa' && <RegulatoryQA />}
              {activeModule === 'schedule-y' && <ScheduleYChecker />}
              {activeModule === 'ich-gcp' && <ICHGCPChecker />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
