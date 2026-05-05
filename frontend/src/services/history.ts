export interface HistoryEntry {
  id: string
  module: string
  moduleId: string
  timestamp: string
  inputSnippet: string
  result: unknown
}

const HISTORY_KEY = 'regcheck_history'
const MAX_HISTORY = 10

export const saveToHistory = (
  module: string,
  moduleId: string,
  input: string,
  result: unknown
): void => {
  try {
    const history = getHistory()
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      module,
      moduleId,
      timestamp: new Date().toISOString(),
      inputSnippet: input.substring(0, 150) + (input.length > 150 ? '...' : ''),
      result
    }
    const updated = [entry, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {
    // localStorage might be full
  }
}

export const getHistory = (): HistoryEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export const clearHistory = (): void => {
  localStorage.removeItem(HISTORY_KEY)
}

export const deleteHistoryEntry = (id: string): void => {
  const history = getHistory().filter(e => e.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
