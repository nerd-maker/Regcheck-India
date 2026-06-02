'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import PlatformDashboard from './PlatformDashboard'

// Lazy-load all 9 agent modules — no SSR needed
const AnonymisationTool        = dynamic(() => import('./AnonymisationTool'),        { ssr: false })
const DocumentSummariser       = dynamic(() => import('./DocumentSummariser'),       { ssr: false })
const CompletenessAssessor     = dynamic(() => import('./CompletenessAssessor'),     { ssr: false })
const SAEClassifier            = dynamic(() => import('./SAEClassifier'),            { ssr: false })
const InspectionReportGenerator = dynamic(() => import('./InspectionReportGenerator'), { ssr: false })
const RegulatoryQA             = dynamic(() => import('./RegulatoryQA'),             { ssr: false })
const ScheduleYChecker         = dynamic(() => import('./ScheduleYChecker'),         { ssr: false })
const ICHGCPChecker            = dynamic(() => import('./ICHGCPChecker'),            { ssr: false })
const CrossDocumentChecker     = dynamic(() => import('./CrossDocumentChecker'),     { ssr: false })

interface Props {
  activeModule: string
  setActiveModule: (id: string) => void
}

const WORKSPACE_IDS = ['dashboard', 'submissions', 'documents', 'reports', 'audit-trail']

const MODULE_MAP: Record<string, React.ReactNode> = {
  'm1-anonymiser':  <AnonymisationTool />,
  'm2-summariser':  <DocumentSummariser />,
  'm3-completeness': <CompletenessAssessor />,
  'm4-classifier':  <SAEClassifier />,
  'm5-inspection':  <InspectionReportGenerator />,
  'm6-qa':          <RegulatoryQA />,
  'm7-scheduley':   <ScheduleYChecker />,
  'm8-ichgcp':      <ICHGCPChecker />,
  'm9-crossdoc':    <CrossDocumentChecker />,
}

const wrapStyle: React.CSSProperties = {
  padding: '20px 24px',
  maxWidth: 960,
  margin: '0 auto',
}

export default function ModuleRenderer({ activeModule, setActiveModule }: Props) {
  // Workspace views → PlatformDashboard
  if (WORKSPACE_IDS.includes(activeModule)) {
    return (
      <div style={wrapStyle}>
        <PlatformDashboard activeView={activeModule} onNavigate={setActiveModule} />
      </div>
    )
  }

  // Settings stubs
  if (activeModule === 'settings' || activeModule === 'apikeys') {
    return (
      <div style={{ ...wrapStyle }}>
        <div className="rc-card" style={{ padding: '32px', textAlign: 'center' }}>
          <i className="ti ti-settings" aria-hidden="true" style={{ fontSize: 28, color: 'var(--rc-text-muted)', display: 'block', marginBottom: 12 }}/>
          <div style={{ fontSize: 14, color: 'var(--rc-text-secondary)', marginBottom: 8 }}>
            {activeModule === 'apikeys' ? 'API Keys' : 'Preferences'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--rc-text-muted)' }}>
            Your Anthropic API key is managed via the settings icon in any agent module.
          </div>
        </div>
      </div>
    )
  }

  const agentModule = MODULE_MAP[activeModule]

  // Unknown module
  if (!agentModule) {
    return (
      <div style={{
        ...wrapStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px - 80px)'
      }}>
        <div style={{ textAlign: 'center', color: 'var(--rc-text-muted)' }}>
          <i className="ti ti-tool" aria-hidden="true" style={{ fontSize: 32, marginBottom: 12, display: 'block' }}/>
          <div style={{ fontSize: 14 }}>Select a module from the sidebar</div>
        </div>
      </div>
    )
  }

  // Agent module — render inside a neutral container
  return (
    <div style={wrapStyle}>
      {agentModule}
    </div>
  )
}
