// Maps regulation citations to official URLs
const REGULATION_URLS: Record<string, string> = {
  // Schedule Y
  'schedule y': 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/scheduleY.pdf',
  // NDCTR 2019
  'ndctr': 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules-Regulations/New-Drugs-Clinical-Trial-Rules/',
  'new drugs and clinical trials': 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules-Regulations/New-Drugs-Clinical-Trial-Rules/',
  // ICH guidelines
  'ich e6': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  'ich e2a': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  'ich e3': 'https://www.ich.org/products/guidelines/efficacy/article/efficacy-guidelines.html',
  // CDSCO
  'cdsco': 'https://cdsco.gov.in',
  // ICMR
  'icmr': 'https://www.icmr.gov.in',
}

export const getRegulationUrl = (citation: string): string | null => {
  const lower = citation.toLowerCase()
  for (const [key, url] of Object.entries(REGULATION_URLS)) {
    if (lower.includes(key)) return url
  }
  return null
}

export function RegulationCitation({
  citation,
  className = ""
}: {
  citation: string
  className?: string
}) {
  const url = getRegulationUrl(citation)

  if (!url) {
    return <span className={className}>{citation}</span>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 hover:underline transition-colors`}
      title="View official regulation"
    >
      {citation}
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}
