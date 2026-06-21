// src/hooks/useWorkspaceData.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchSubmissions, fetchDocuments, fetchApplications,
  fetchRegistrations, fetchCorrespondence,
} from '@/services/workspaceData'
import {
  SubmissionRecord, DocumentRecord, ApplicationRecord,
  RegistrationRecord, HACorrespondenceRecord,
} from '@/types/workspace'

// Generic data hook
// - Starts with mockData immediately (no blank loading state)
// - Fetches real data in background
// - Replaces mockData with real data silently
// - loading=false by default so UI is never blocked

function useData<T>(
  fetcher: () => Promise<T[]>,
  fallback: T[]
) {
  const [data, setData] = useState<T[]>(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref keeps latest fetcher without causing effect re-runs
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch {
      setError('Failed to load')
      // fallback data already shown — no visible failure
    } finally {
      setLoading(false)
    }
  }, []) // stable — never recreated

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    reload()
  }, []) // run once on mount only

  return { data, loading, error, reload, setData }
}

export function useSubmissions() {
  return useData<SubmissionRecord>(fetchSubmissions, [])
}

export function useDocuments(submissionId?: string) {
  const fetcher = useCallback(
    () => fetchDocuments(submissionId),
    [submissionId]
  )
  return useData<DocumentRecord>(fetcher, [])
}

export function useApplications() {
  return useData<ApplicationRecord>(fetchApplications, [])
}

export function useRegistrations() {
  return useData<RegistrationRecord>(fetchRegistrations, [])
}

export function useCorrespondence(submissionId?: string) {
  const fetcher = useCallback(
    () => fetchCorrespondence(submissionId),
    [submissionId]
  )
  return useData<HACorrespondenceRecord>(fetcher, [])
}
