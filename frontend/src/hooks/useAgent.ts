// src/hooks/useAgent.ts
// Handles the full agent run lifecycle: cold start, text extraction, API call,
// result parsing, and error handling.

import { useState, useCallback } from "react"
import { pingBackend, extractTextFromFile } from "@/lib/api"

export type AgentStatus =
  | "idle"
  | "waking"      // Render cold start — backend is waking up
  | "extracting"  // Extracting text from file
  | "running"     // Calling the agent
  | "done"
  | "error"

interface UseAgentOptions {
  // The actual API call function to run after text is extracted
  run: (text: string) => Promise<Record<string, unknown>>
  // For file-based agents. For Q&A, pass null and call run() directly
  file?: File | null
}

export function useAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle")
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)

  const execute = useCallback(async (options: UseAgentOptions) => {
    setStatus("idle")
    setResult(null)
    setError(null)

    try {
      // 1. Check if backend is awake (Render free tier sleeps)
      const isAwake = await pingBackend()
      if (!isAwake) {
        setStatus("waking")
        // Poll every 5s until awake, max 90s
        let attempts = 0
        while (attempts < 18) {
          await new Promise((r) => setTimeout(r, 5000))
          const awake = await pingBackend()
          if (awake) break
          attempts++
        }
      }

      // 2. Extract text from file (if file-based agent)
      let documentText = ""
      if (options.file) {
        setStatus("extracting")
        documentText = await extractTextFromFile(options.file)
        setRawText(documentText)
      }

      // 3. Run the agent
      setStatus("running")
      const response = await options.run(documentText)
      setResult(response)
      setStatus("done")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setStatus("error")
    }
  }, [])

  const reset = useCallback(() => {
    setStatus("idle")
    setResult(null)
    setError(null)
    setRawText(null)
  }, [])

  return { status, result, error, rawText, execute, reset }
}
