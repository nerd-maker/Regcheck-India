// src/utils/parseGaps.ts
// Extracts structured gaps from agent free-text output so they
// can be passed to GapRemediationPanel as pendingGaps.

export interface ParsedGap {
  text: string
  severity: 'critical' | 'major' | 'minor'
  framework?: string
  sectionRef?: string
}

/**
 * Parses free-text agent output and extracts gap items.
 * Works with the output format of Schedule Y, ICH GCP,
 * Completeness, and Inspection Report agents.
 */
export function parseGapsFromResult(result: unknown): ParsedGap[] {
  const text =
    typeof result === 'string' ? result : JSON.stringify(result)

  const gaps: ParsedGap[] = []
  const lines = text.split('\n')

  let currentSeverity: 'critical' | 'major' | 'minor' = 'major'

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Detect severity section headers
    if (/CRITICAL/i.test(line) && line.length < 40) {
      currentSeverity = 'critical'
      continue
    }
    if (/MAJOR/i.test(line) && line.length < 40) {
      currentSeverity = 'major'
      continue
    }
    if (/MINOR/i.test(line) && line.length < 40) {
      currentSeverity = 'minor'
      continue
    }

    // Detect inline severity markers
    let sev: 'critical' | 'major' | 'minor' = currentSeverity
    if (/\bCRITICAL\b/i.test(line)) sev = 'critical'
    else if (/\bMAJOR\b/i.test(line)) sev = 'major'
    else if (/\bMINOR\b/i.test(line)) sev = 'minor'

    // Must look like a gap line
    const isGapLine =
      line.startsWith('§') ||
      line.startsWith('–') ||
      line.startsWith('-') ||
      line.startsWith('Finding') ||
      /gap|missing|absent|incomplete|required|not\s+found|not\s+defined/i.test(
        line,
      )

    if (!isGapLine) continue
    if (line.length < 15) continue // too short to be a gap

    // Extract section reference
    const sectionMatch = line.match(
      /§[\d.]+[a-z]?|Rule\s+\d+|Section\s+\d+|ICH\s+\w+\s+§[\d.]+/i,
    )

    // Extract framework reference
    const frameworkMatch = line.match(
      /Schedule\s+Y|ICH\s+E\d+[A-Za-z()0-9]*/i,
    )

    // Clean the gap text
    let gapText = line
      .replace(/^[§\-–•*]+\s*/, '')
      .replace(/^(CRITICAL|MAJOR|MINOR)[:\s]*/i, '')
      .replace(/Finding\s+\d+\s*[–-]\s*/i, '')
      .trim()

    if (gapText.length < 15) continue

    gaps.push({
      text: gapText,
      severity: sev,
      framework: frameworkMatch?.[0],
      sectionRef: sectionMatch?.[0],
    })
  }

  // Deduplicate by text
  const seen = new Set<string>()
  return gaps.filter((g) => {
    if (seen.has(g.text)) return false
    seen.add(g.text)
    return true
  })
}
