'use client'

// Workspace store — keeps track of currently selected submission/document and
// the inspector panel state. Plain React context to avoid extra deps.

import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SubmissionRecord, DocumentRecord, SUBMISSIONS as initialSubmissions } from './mockData'

type InspectorTab = 'details' | 'actions' | 'activity'

interface WorkspaceState {
  activeView: string
  setActiveView: (view: string) => void

  selectedSubmissionId: string | null
  setSelectedSubmissionId: (id: string | null) => void

  selectedDocumentId: string | null
  setSelectedDocumentId: (id: string | null) => void

  inspectorOpen: boolean
  inspectorTab: InspectorTab
  openInspector: (tab?: InspectorTab) => void
  closeInspector: () => void
  setInspectorTab: (t: InspectorTab) => void

  // Compliance Action panel — running an agent against the selected document
  activeAction: string | null              // e.g. 'm7-scheduley'
  startAction: (id: string) => void
  endAction: () => void

  submissions: SubmissionRecord[]
  addSubmission: (sub: any) => void
}

const Ctx = createContext<WorkspaceState | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(initialSubmissions)
  const [activeView, setActiveView] = useState<string>('home')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details')
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // ── Sync pathname to activeView ─────────────────────────────────────────
  useEffect(() => {
    if (pathname === '/app') setActiveView('home')
    else if (pathname === '/app/settings') setActiveView('settings')
    else if (pathname === '/app/api-vaults') setActiveView('apikeys')
    else if (pathname === '/app/submissions') setActiveView('submissions')
    else if (pathname.startsWith('/app/submissions/')) setActiveView('submission-detail')
    else if (pathname === '/app/applications') setActiveView('applications')
    else if (pathname === '/app/registrations') setActiveView('registrations')
    else if (pathname === '/app/documents') setActiveView('documents')
    else if (pathname === '/app/correspondence') setActiveView('correspondence')
    else if (pathname === '/app/audit-trail') setActiveView('audit')
    else if (pathname === '/app/reports') setActiveView('reports')
    else if (pathname === '/app/agents/pii-anonymiser') setActiveView('m1-anonymiser')
    else if (pathname === '/app/agents/document-summariser') setActiveView('m2-summariser')
    else if (pathname === '/app/agents/completeness-check') setActiveView('m3-completeness')
    else if (pathname === '/app/agents/case-classifier') setActiveView('m4-classifier')
    else if (pathname === '/app/agents/inspection-report') setActiveView('m5-inspection')
    else if (pathname === '/app/agents/regulatory-qa') setActiveView('m6-qa')
    else if (pathname === '/app/agents/schedule-y-check') setActiveView('m7-scheduley')
    else if (pathname === '/app/agents/ich-e6r3-gcp') setActiveView('m8-ichgcp')
    else if (pathname === '/app/agents/cross-doc-check') setActiveView('m9-crossdoc')
  }, [pathname])

  // ── Programmatic transition wrapper ──────────────────────────────────────
  const handleSetActiveView = useCallback((view: string) => {
    setActiveView(view)
    if (view === 'home') router.push('/app')
    else if (view === 'settings') router.push('/app/settings')
    else if (view === 'apikeys') router.push('/app/api-vaults')
    else if (view === 'submissions') router.push('/app/submissions')
    else if (view === 'submission-detail') {
      router.push(`/app/submissions/${selectedSubmissionId || 's-001'}`)
    }
    else if (view === 'applications') router.push('/app/applications')
    else if (view === 'registrations') router.push('/app/registrations')
    else if (view === 'documents') router.push('/app/documents')
    else if (view === 'correspondence') router.push('/app/correspondence')
    else if (view === 'audit') router.push('/app/audit-trail')
    else if (view === 'reports') router.push('/app/reports')
    else if (view === 'm1-anonymiser') router.push('/app/agents/pii-anonymiser')
    else if (view === 'm2-summariser') router.push('/app/agents/document-summariser')
    else if (view === 'm3-completeness') router.push('/app/agents/completeness-check')
    else if (view === 'm4-classifier') router.push('/app/agents/case-classifier')
    else if (view === 'm5-inspection') router.push('/app/agents/inspection-report')
    else if (view === 'm6-qa') router.push('/app/agents/regulatory-qa')
    else if (view === 'm7-scheduley') router.push('/app/agents/schedule-y-check')
    else if (view === 'm8-ichgcp') router.push('/app/agents/ich-e6r3-gcp')
    else if (view === 'm9-crossdoc') router.push('/app/agents/cross-doc-check')
  }, [router, selectedSubmissionId])

  // ── Add submission helper ───────────────────────────────────────────────
  const addSubmission = useCallback((sub: any) => {
    const nextNum = 1000 + Math.floor(Math.random() * 9000)
    const newRecord: SubmissionRecord = {
      id: `s-${submissions.length + 1}`,
      number: `RC-SUB-2025-${nextNum}`,
      name: `${sub.product} — ${sub.type}`,
      type: sub.type,
      product: sub.product,
      indication: sub.indication,
      state: 'draft',
      stateLabel: 'Draft',
      haAuthority: 'CDSCO',
      phase: sub.phase,
      owner: { id: 'p1', name: 'Anika Sharma', initials: 'AS', role: 'Regulatory Lead' },
      targetSubmitDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      riskLevel: 'low',
      documents: 0,
      openGaps: 0,
      complianceScore: 100,
      frameworks: ['NDCTR 2019'],
      updatedAt: 'Just now',
    }
    setSubmissions(prev => [newRecord, ...prev])
  }, [submissions])

  const openInspector = useCallback((tab: InspectorTab = 'details') => {
    setInspectorTab(tab)
    setInspectorOpen(true)
  }, [])
  const closeInspector = useCallback(() => setInspectorOpen(false), [])

  const startAction = useCallback((id: string) => {
    setActiveAction(id)
    setInspectorTab('actions')
    setInspectorOpen(true)
  }, [])
  const endAction = useCallback(() => setActiveAction(null), [])

  const value = useMemo<WorkspaceState>(() => ({
    activeView,
    setActiveView: handleSetActiveView,
    selectedSubmissionId, setSelectedSubmissionId,
    selectedDocumentId, setSelectedDocumentId,
    inspectorOpen, inspectorTab,
    openInspector, closeInspector, setInspectorTab,
    activeAction, startAction, endAction,
    submissions, addSubmission
  }), [
    activeView, handleSetActiveView, selectedSubmissionId, selectedDocumentId,
    inspectorOpen, inspectorTab, openInspector, closeInspector,
    activeAction, startAction, endAction, submissions, addSubmission
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

export function useSelectedSubmission(all?: SubmissionRecord[]) {
  const { selectedSubmissionId, submissions } = useWorkspace()
  const list = all ?? submissions
  return list.find(s => s.id === selectedSubmissionId) ?? null
}

export function useSelectedDocument(all: DocumentRecord[]) {
  const { selectedDocumentId } = useWorkspace()
  return all.find(d => d.id === selectedDocumentId) ?? null
}

