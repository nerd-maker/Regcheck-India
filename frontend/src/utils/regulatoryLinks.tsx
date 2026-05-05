import React from 'react'

const REGULATION_URLS: Record<string, string> = {
  'schedule y': 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/scheduleY.pdf',
  ndctr: 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules-Regulations/New-Drugs-Clinical-Trial-Rules/',
  'new drugs and clinical trials': 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules-Regulations/New-Drugs-Clinical-Trial-Rules/',
  'ich e6': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  'ich e2a': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  'ich e3': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  cdsco: 'https://cdsco.gov.in',
  icmr: 'https://www.icmr.gov.in',
}

export const getRegulationUrl = (citation: string): string | null => {
  const lower = citation.toLowerCase()
  for (const [key, url] of Object.entries(REGULATION_URLS)) {
    if (lower.includes(key)) return url
  }
  return null
}

export const RegulationCitation = ({
  citation,
  className = '',
}: {
  citation: string
  className?: string
}) => {
  const url = getRegulationUrl(citation)

  if (!url) {
    return <span className={className}>{citation}</span>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} inline-flex items-center gap-1 text-teal-400 transition-colors hover:text-teal-300 hover:underline`}
      title="View official regulation"
    >
      {citation}
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}
