// src/utils/formatAgentResult.ts
// Converts any backend agent JSON response into human-readable text
// + structured sections for the result panel.

export interface FormattedResult {
  displayText: string        // for plain-text export / pre block fallback
  complianceScore?: number   // extracted 0-100
  sections: {
    title: string
    items: string[]
    severity?: 'critical' | 'major' | 'minor' | 'positive'
  }[]
}

export function formatAgentResult(raw: unknown): FormattedResult {
  // Already a plain non-JSON string → return as-is
  if (
    typeof raw === 'string' &&
    !raw.trimStart().startsWith('{') &&
    !raw.trimStart().startsWith('[')
  ) {
    return { displayText: raw, sections: [], complianceScore: undefined }
  }

  // Parse string to object
  let data: any = raw
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw) } catch {
      return { displayText: raw, sections: [], complianceScore: undefined }
    }
  }

  // CRITICAL: unwrap nested result field.
  // Backend wraps actual result in data.result.
  // Some agents return data.output, data.analysis, data.answer, etc.
  const inner =
    data?.result   ??
    data?.output   ??
    data?.analysis ??
    data?.answer   ??
    data?.summary  ??
    data?.findings ??
    data?.report   ??
    data  // fallback to top-level if no wrapper

  const sections: FormattedResult['sections'] = []
  const lines: string[] = []

  // ── Compliance score ───────────────────────────────────────────────────────
  const pct =
    inner?.compliance_percentage ??
    inner?.completeness_percentage ??
    inner?.gcp_percentage ??
    inner?.compliance_score ??
    inner?.overall_completeness_score ??
    inner?.gcp_score ??
    inner?.overall_score ??
    inner?.confidence ??
    inner?.confidence_score

  const score =
    pct !== undefined
      ? parseFloat(String(pct).replace('%', ''))
      : undefined

  // ── Status header ──────────────────────────────────────────────────────────
  const status =
    inner?.overall_compliance_status ??
    inner?.overall_gcp_status ??
    inner?.submission_readiness ??
    inner?.status ??
    inner?.overall_status

  if (status) lines.push(`Status: ${status}`)
  if (pct !== undefined) {
    lines.push(
      `Compliance: ${String(pct).includes('%') ? pct : pct + '%'}`,
    )
  }
  if (lines.length) lines.push('')

  // ── Helper: add a section + contribute to lines ────────────────────────────
  const addSection = (
    title: string,
    arr: unknown,
    severity?: FormattedResult['sections'][0]['severity'],
  ) => {
    if (!arr) return
    const items: string[] = Array.isArray(arr)
      ? arr
          .map((item: any) => {
            if (typeof item === 'string') return item
            if (item?.requirement && item?.finding) {
              return (
                `${item.requirement}: ${item.finding}` +
                (item.corrective_action &&
                item.corrective_action !== 'None required'
                  ? ` → Action: ${item.corrective_action}`
                  : '')
              )
            }
            if (item?.finding) return item.finding
            if (item?.description) return item.description
            if (item?.text) return item.text
            if (item?.gap) return item.gap
            if (item?.issue) return item.issue
            if (item?.item) return item.item
            // Last resort for objects: join key=value pairs
            return Object.entries(item)
              .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          })
          .filter(Boolean)
      : [String(arr)]

    if (items.length === 0) return
    sections.push({ title, items, severity })
    lines.push(`── ${title.toUpperCase()} ${'─'.repeat(Math.max(0, 44 - title.length))}`)
    items.forEach((item) => lines.push(`  • ${item}`))
    lines.push('')
  }

  // ── Critical ───────────────────────────────────────────────────────────────
  addSection(
    'Critical Non-Compliances',
    inner?.critical_non_compliances ??
      inner?.critical_gaps ??
      inner?.critical_deviations ??
      inner?.critical,
    'critical',
  )

  // ── Major ──────────────────────────────────────────────────────────────────
  addSection(
    'Major Non-Compliances',
    inner?.major_non_compliances ??
      inner?.major_gaps ??
      inner?.major_deviations ??
      inner?.incomplete_sections ??
      inner?.major,
    'major',
  )

  // ── Minor ──────────────────────────────────────────────────────────────────
  addSection(
    'Minor Non-Compliances',
    inner?.minor_non_compliances ??
      inner?.minor_gaps ??
      inner?.minor_deviations ??
      inner?.minor,
    'minor',
  )

  // ── Checklist (if no separate gap arrays were found) ───────────────────────
  if (sections.length === 0 && inner?.compliance_checklist) {
    const nonCompliant = (inner.compliance_checklist as any[]).filter(
      (c: any) => c?.status !== 'COMPLIANT',
    )
    const compliant = (inner.compliance_checklist as any[]).filter(
      (c: any) => c?.status === 'COMPLIANT',
    )
    addSection('Non-Compliant Items', nonCompliant, 'major')
    addSection('Compliant Items', compliant, 'positive')
  } else if (inner?.compliance_checklist) {
    addSection(
      'Requirement Checklist',
      (inner.compliance_checklist as any[]).filter(
        (c: any) => c?.status !== 'COMPLIANT',
      ),
      'major',
    )
  }

  // ── GCP principles ─────────────────────────────────────────────────────────
  if (inner?.gcp_principles) {
    addSection(
      'GCP Principles (Non-Compliant)',
      (inner.gcp_principles as any[]).filter(
        (c: any) => c?.status !== 'COMPLIANT',
      ),
      'major',
    )
  }

  // ── Strengths ──────────────────────────────────────────────────────────────
  addSection(
    'Strengths',
    inner?.strengths ?? inner?.positive_findings,
    'positive',
  )

  // ── Recommendations ────────────────────────────────────────────────────────
  addSection(
    'Recommendations',
    inner?.recommendations ??
      inner?.priority_actions ??
      inner?.actions_required,
  )

  // ── Findings (generic — inspection / summary) ──────────────────────────────
  addSection(
    'Findings',
    inner?.findings ?? inner?.issues ?? inner?.key_findings,
  )

  // ── Q&A agent ──────────────────────────────────────────────────────────────
  if (inner?.answer) {
    lines.push('── ANSWER ' + '─'.repeat(35))
    lines.push(inner.answer)
    lines.push('')
    if (inner?.references) {
      addSection('Regulatory Basis', inner.references)
    }
    if (inner?.key_requirements) {
      addSection('Key Requirements', inner.key_requirements)
    }
    if (inner?.confidence) lines.push(`Confidence: ${inner.confidence}`)
  }

  // ── Summariser ─────────────────────────────────────────────────────────────
  if (inner?.summary) {
    lines.push('── SUMMARY ' + '─'.repeat(34))
    lines.push(inner.summary)
    lines.push('')
  }
  if (inner?.key_sections) {
    addSection('Key Sections', inner.key_sections)
  }

  // ── PII Anonymiser ─────────────────────────────────────────────────────────
  if (inner?.entities_detected !== undefined || inner?.pii_count !== undefined) {
    lines.push('── PII DETECTION RESULTS ' + '─'.repeat(20))
    const count = inner.entities_detected ?? inner.pii_count
    if (count !== undefined) lines.push(`Total PII entities detected: ${count}`)
    const risk = inner.risk_level ?? inner.risk_classification
    if (risk) lines.push(`Risk level: ${risk}`)
    if (inner?.dpdp_compliant !== undefined) {
      lines.push(
        `DPDP Act 2023 status: ${
          inner.dpdp_compliant
            ? '✓ Compliant after redaction'
            : '✗ Requires action'
        }`,
      )
    }
    lines.push('')
    addSection(
      'Detected PII Categories',
      inner.categories ?? inner.pii_categories ?? inner.entity_types,
      'major',
    )
    addSection('Redaction Recommendations', inner.recommendations)
  }

  // ── Case Classifier ────────────────────────────────────────────────────────
  if (inner?.seriousness || inner?.causality || inner?.classification) {
    lines.push('── CASE CLASSIFICATION ' + '─'.repeat(22))
    if (inner.classification)  lines.push(`Classification: ${inner.classification}`)
    if (inner.seriousness)     lines.push(`Seriousness: ${inner.seriousness}`)
    if (inner.expectedness)    lines.push(`Expectedness: ${inner.expectedness}`)
    if (inner.causality)       lines.push(`Causality: ${inner.causality}`)
    if (inner.expedited_reporting !== undefined) {
      lines.push(
        `Expedited reporting required: ${inner.expedited_reporting ? 'YES' : 'NO'}`,
      )
    }
    if (inner.reporting_timeline) {
      lines.push(`Reporting timeline: ${inner.reporting_timeline}`)
    }
    lines.push('')
  }

  // ── Cross-document check ───────────────────────────────────────────────────
  if (inner?.inconsistencies !== undefined || inner?.conflicts !== undefined) {
    lines.push('── CROSS-DOCUMENT ANALYSIS ' + '─'.repeat(18))
    const count = inner.inconsistencies ?? inner.conflict_count
    if (count !== undefined) {
      lines.push(
        `Total inconsistencies found: ${
          typeof count === 'number' ? count : JSON.stringify(count)
        }`,
      )
    }
    lines.push('')
    addSection(
      'Critical Inconsistencies',
      inner.critical_conflicts ?? inner.critical_inconsistencies,
      'critical',
    )
    addSection(
      'Major Inconsistencies',
      inner.major_conflicts ?? inner.major_inconsistencies,
      'major',
    )
    addSection(
      'Minor Inconsistencies',
      inner.minor_conflicts ?? inner.minor_inconsistencies,
      'minor',
    )
  }

  // ── FINAL SAFETY NET ───────────────────────────────────────────────────────
  // If we still have nothing useful, render string values from the object
  // rather than dumping raw JSON
  if (lines.filter(l => l.trim()).length <= 2 && sections.length === 0) {
    const stringValues = Object.entries(inner || {})
      .filter(([, v]) => typeof v === 'string' && (v as string).length > 10)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)

    if (stringValues.length > 0) {
      return {
        displayText: stringValues.join('\n\n'),
        complianceScore: score,
        sections: [],
      }
    }

    // Absolute last resort — pretty JSON with a warning header
    return {
      displayText:
        '── RAW RESULT (parser could not format this response) ──\n\n' +
        JSON.stringify(inner ?? data, null, 2),
      complianceScore: score,
      sections: [],
    }
  }

  return {
    displayText: lines.join('\n').trim(),
    complianceScore: score,
    sections,
  }
}
