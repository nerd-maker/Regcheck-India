// src/hooks/useWorkspaceData.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchSubmissions, fetchDocuments, fetchApplications,
  fetchRegistrations, fetchCorrespondence,
} from '@/services/workspaceData'
import {
  SubmissionRecord, DocumentRecord, ApplicationRecord,
  RegistrationRecord, HACorrespondenceRecord,
  SUBMISSIONS, DOCUMENTS, APPLICATIONS,
  REGISTRATIONS, HA_CORRESPONDENCE,
} from '@/lib/mockData'

// Generic data hook factory
function useData<T>(
  fetcher: () => Promise<T[]>,
  fallback: T[]
) {
  const [data, setData] = useState<T[]>(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (e) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => { reload() }, [reload])

  return { data, loading, error, reload, setData }
}

export function useSubmissions() {
  return useData<SubmissionRecord>(fetchSubmissions, SUBMISSIONS)
}

export function useDocuments(submissionId?: string) {
  const fetcher = useCallback(
    () => fetchDocuments(submissionId),
    [submissionId]
  )
  return useData<DocumentRecord>(
    fetcher,
    submissionId
      ? DOCUMENTS.filter(d => d.submissionId === submissionId)
      : DOCUMENTS
  )
}

export function useApplications() {
  return useData<ApplicationRecord>(fetchApplications, APPLICATIONS)
}

export function useRegistrations() {
  return useData<RegistrationRecord>(fetchRegistrations, REGISTRATIONS)
}

export function useCorrespondence(submissionId?: string) {
  const fetcher = useCallback(
    () => fetchCorrespondence(submissionId),
    [submissionId]
  )
  return useData<HACorrespondenceRecord>(
    fetcher,
    submissionId
      ? HA_CORRESPONDENCE.filter(h => h.submissionId === submissionId)
      : HA_CORRESPONDENCE
  )
}
