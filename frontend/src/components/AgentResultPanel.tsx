// src/components/AgentResultPanel.tsx
// Reusable result display component used by all agent pages.
// Intelligently renders the API response from any field the backend returns.

"use client"

import { AgentResponse } from "@/lib/api"

interface AgentResultPanelProps {
  result: AgentResponse
  agentName: string
  agentId: string
  filename?: string
  onReset: () => void
}

export function AgentResultPanel({
  result,
  agentName,
  agentId,
  filename,
  onReset,
}: AgentResultPanelProps) {
  // Extract the main text output from whatever field the API returns.
  // The backend AgentResponse model returns a `result` field which can be
  // a string or object. We stringify objects for display.
  const rawResult = result.result ?? result.output ?? result.analysis ??
    result.findings ?? result.answer ?? result.summary ?? result.gaps ??
    result.classification ?? result.report

  const outputText: string =
    rawResult === undefined
      ? JSON.stringify(result, null, 2)
      : typeof rawResult === "string"
      ? rawResult
      : JSON.stringify(rawResult, null, 2)

  const handleDownload = () => {
    const blob = new Blob([outputText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${agentId}-report.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Result header */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(26, 86, 219, 0.05)",
          color: "var(--rc-primary)",
          fontSize: 12.5,
          fontWeight: 600,
          borderBottom: "1px solid var(--rc-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-sparkles" />
          {agentName} — Analysis Complete
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="rc-btn rc-btn-ghost rc-btn-sm"
            onClick={handleDownload}
          >
            <i className="ti ti-download" /> Download Report
          </button>
          <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onReset}>
            <i className="ti ti-rotate" /> Run Again
          </button>
        </div>
      </div>

      {/* Filename if present */}
      {filename && (
        <div
          style={{
            padding: "8px 16px",
            fontSize: 11,
            color: "var(--rc-text-muted)",
            borderBottom: "1px solid var(--rc-divider)",
            background: "var(--rc-bg-secondary)",
          }}
        >
          Document: <strong>{filename}</strong>
        </div>
      )}

      {/* Main output */}
      <div
        className="rc-scroll"
        style={{ flex: 1, overflowY: "auto", maxHeight: 500 }}
      >
        <pre
          style={{
            margin: 0,
            padding: 16,
            fontSize: 12,
            fontFamily: "var(--font-mono, 'Courier New', monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.65,
            color: "var(--rc-text-primary)",
          }}
        >
          {outputText}
        </pre>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          color: "var(--rc-text-muted)",
          fontStyle: "italic",
          borderTop: "1px solid var(--rc-divider)",
        }}
      >
        All outputs require review by a qualified Regulatory Affairs professional before CDSCO submission.
      </div>
    </div>
  )
}
