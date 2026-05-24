'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWorkspace } from '@/lib/workspaceStore'
import SubmissionDetailView from '@/components/views/SubmissionDetailView'

export default function SubmissionDetailPage() {
  const params = useParams()
  const { setSelectedSubmissionId } = useWorkspace()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (params.id) {
      setSelectedSubmissionId(params.id as string)
      setMounted(true)
    }
  }, [params.id, setSelectedSubmissionId])

  if (!mounted) return null
  return <SubmissionDetailView />
}
