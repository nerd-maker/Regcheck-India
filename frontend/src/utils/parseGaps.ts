// src/utils/parseGaps.ts
// Extracts structured gaps from agent output (JSON or text) so they
// can be passed to GapRemediationPanel as pendingGaps.

import { formatAgentResult } from './formatAgentResult'

export interface ParsedGap {
  text: string
  severity: 'critical' | 'major' | 'minor'
  framework?: string
  sectionRef?: string
}

/**
 * Primary entry-point: handles both structured JSON (from backend) and
 * free-text agent output. Uses formatAgentResult to extract sections first,
 * then falls back to line-by-line text parsing.
 */
export function parseGapsFromResult(result: unknown): ParsedGap[] {
  const formatted = formatAgentResult(result)
  const gaps: ParsedGap[] = []

  // ── Structured path: use typed sections from formatAgentResult ────────────
  for (const section of formatted.sections) {
    const sev = section.severity
    // Skip positive/strength sections — they're not gaps
    if (!sev || sev === 'positive') continue

    const severity: 'critical' | 'major' | 'minor' =
      sev === 'critical' ? 'critical' : sev === 'major' ? 'major' : 'minor'

    for (const item of section.items) {
      if (item.length < 15) continue

      const sectionMatch = item.match(
        /§[\d.]+[a-z]?|Rule\s+\d+|Section\s+[\d.]+|Part\s+[IVX]+/i,
      )
      const frameworkMatch = item.match(
        /Schedule\s+[YM]|ICH\s+E\d+[A-Za-z()0-9]*|NDCTR|CTRI|DPDP/i,
      )

      gaps.push({
        text: item.replace(/^[•\-–]\s*/, '').trim(),
        severity,
        framework: frameworkMatch?.[0],
        sectionRef: sectionMatch?.[0],
      })
    }
  }

  // ── Fallback: line-by-line text parsing when no sections were extracted ────
  if (gaps.length === 0) {
    return parseGapsFromText(formatted.displayText)
  }

  // Deduplicate by text
  const seen = new Set<string>()
  return gaps.filter((g) => {
    if (seen.has(g.text)) return false
    seen.add(g.text)
    return true
  })
}

/** Line-by-line parser — used as fallback for plain-text agent responses. */
function parseGapsFromText(text: string): ParsedGap[] {
  const gaps: ParsedGap[] = []
  const lines = text.split('\n')
  let currentSeverity: 'critical' | 'major' | 'minor' = 'major'

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('──')) continue // section dividers

    // Severity section headers
    if (/CRITICAL/i.test(line) && line.length < 60) {
      currentSeverity = 'critical'
      continue
    }
    if (/MAJOR/i.test(line) && line.length < 60) {
      currentSeverity = 'major'
      continue
    }
    if (/MINOR/i.test(line) && line.length < 60) {
      currentSeverity = 'minor'
      continue
    }

    // Inline severity override
    let sev: 'critical' | 'major' | 'minor' = currentSeverity
    if (/\bCRITICAL\b/i.test(line)) sev = 'critical'
    else if (/\bMAJOR\b/i.test(line)) sev = 'major'
    else if (/\bMINOR\b/i.test(line)) sev = 'minor'

    // Filter: must look like a gap
    const isGapLine =
      line.startsWith('•') ||
      line.startsWith('–') ||
      line.startsWith('-') ||
      line.startsWith('§') ||
      line.startsWith('Finding') ||
      /gap|missing|absent|incomplete|required|non.compliant|not\s+found|not\s+defined/i.test(
        line,
      )

    if (!isGapLine) continue
    if (line.length < 15) continue

    const sectionMatch = line.match(
      /§[\d.]+[a-z]?|Rule\s+\d+|Section\s+[\d.]+|Part\s+[IVX]+/i,
    )
    const frameworkMatch = line.match(
      /Schedule\s+[YM]|ICH\s+E\d+[A-Za-z()0-9]*|NDCTR|CTRI|DPDP/i,
    )

    const gapText = line
      .replace(/^[•\-–§*]\s*/, '')
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

  // Deduplicate
  const seen = new Set<string>()
  return gaps.filter((g) => {
    if (seen.has(g.text)) return false
    seen.add(g.text)
    return true
  })
}
