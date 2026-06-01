'use client'

// Workspace store — keeps track of currently selected submission/document and
// the inspector panel state. Plain React context to avoid extra deps.

import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from 'react'
import { SubmissionRecord, DocumentRecord } from './mockData'

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

  // Pre-filled agent input (used when "Compliance Action" is launched from
  // the inspector — the document's text gets passed to the agent page).
  prefilledInput: string
  setPrefilledInput: (text: string) => void
  consumePrefilledInput: () => string         // read + clear in one shot
}

const Ctx = createContext<WorkspaceState | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<string>('home')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details')
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [prefilledInput, setPrefilledInputState] = useState<string>('')

  const [hashParsed, setHashParsed] = useState(false)

  // ── URL hash sync (deep-linkable views) ─────────────────────────────────
  // #/<view>[/sub/<id>][/doc/<id>]
  useEffect(() => {
    const parse = () => {
      const raw = window.location.hash.replace(/^#\/?/, '')
      if (!raw) { setHashParsed(true); return }
      const parts = raw.split('/')
      if (parts[0]) setActiveView(parts[0])
      const subIdx = parts.indexOf('sub')
      if (subIdx >= 0 && parts[subIdx + 1]) setSelectedSubmissionId(parts[subIdx + 1])
      const docIdx = parts.indexOf('doc')
      if (docIdx >= 0 && parts[docIdx + 1]) setSelectedDocumentId(parts[docIdx + 1])
      setHashParsed(true)
    }
    parse()
    window.addEventListener('hashchange', parse)
    return () => window.removeEventListener('hashchange', parse)
  }, [])

  useEffect(() => {
    if (!hashParsed) return                                // wait for initial parse
    const parts = [activeView]
    if (selectedSubmissionId && activeView === 'submission-detail') parts.push('sub', selectedSubmissionId)
    const target = `#/${parts.join('/')}`
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [activeView, selectedSubmissionId, hashParsed])

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

  const setPrefilledInput = useCallback((text: string) => setPrefilledInputState(text), [])
  const consumePrefilledInput = useCallback(() => {
    const v = prefilledInput
    setPrefilledInputState('')
    return v
  }, [prefilledInput])

  const value = useMemo<WorkspaceState>(() => ({
    activeView, setActiveView,
    selectedSubmissionId, setSelectedSubmissionId,
    selectedDocumentId, setSelectedDocumentId,
    inspectorOpen, inspectorTab,
    openInspector, closeInspector, setInspectorTab,
    activeAction, startAction, endAction,
    prefilledInput, setPrefilledInput, consumePrefilledInput,
  }), [
    activeView, selectedSubmissionId, selectedDocumentId,
    inspectorOpen, inspectorTab, openInspector, closeInspector,
    activeAction, startAction, endAction,
    prefilledInput, setPrefilledInput, consumePrefilledInput,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

export function useSelectedSubmission(all: SubmissionRecord[]) {
  const { selectedSubmissionId } = useWorkspace()
  return all.find(s => s.id === selectedSubmissionId) ?? null
}

export function useSelectedDocument(all: DocumentRecord[]) {
  const { selectedDocumentId } = useWorkspace()
  return all.find(d => d.id === selectedDocumentId) ?? null
}
