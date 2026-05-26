// src/components/AgentStatusBar.tsx
// Shows real-time status during the backend call.
// Render cold starts can take 30-60 seconds — the user must know what's happening.

"use client"

import { AgentStatus } from "@/hooks/useAgent"

const STATUS_CONFIG = {
  waking: {
    message: "Backend is waking up (Render cold start — may take up to 60s)…",
    color: "var(--rc-orange)",
    showSpinner: true,
  },
  extracting: {
    message: "Extracting text from document…",
    color: "var(--rc-primary)",
    showSpinner: true,
  },
  running: {
    message: "AI agent is analysing your document…",
    color: "var(--rc-primary)",
    showSpinner: true,
  },
  error: {
    message: "",
    color: "var(--rc-red)",
    showSpinner: false,
  },
} as const

interface AgentStatusBarProps {
  status: AgentStatus
  error?: string | null
}

export function AgentStatusBar({ status, error }: AgentStatusBarProps) {
  if (status === "idle" || status === "done") return null

  if (status === "error") {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(239, 68, 68, 0.07)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: 8,
          fontSize: 12.5,
          color: "var(--rc-red)",
          lineHeight: 1.6,
        }}
      >
        <strong>Analysis failed.</strong>{" "}
        {error || "An unexpected error occurred."}
        <br />
        <span style={{ fontSize: 11.5, opacity: 0.8 }}>
          If the backend is sleeping, wait 60s and try again. Persistent errors: contact@regcheck.in
        </span>
      </div>
    )
  }

  const config = STATUS_CONFIG[status]
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12.5,
        color: config.color,
        fontWeight: 500,
      }}
    >
      {config.showSpinner && (
        <svg
          className="animate-spin"
          style={{ width: 16, height: 16, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
          />
        </svg>
      )}
      {config.message}
    </div>
  )
}
