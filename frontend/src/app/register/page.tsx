'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    // Set default org name so the app layout has something to display
    if (!localStorage.getItem('demo_org')) {
      localStorage.setItem('demo_org', 'RegCheck Demo')
    }
    router.replace('/app')
  }, [router])

  return null
}
