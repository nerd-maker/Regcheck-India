// Tiny CSV export helper — no deps. Triggers a browser download.

export type CSVRow = Record<string, string | number | boolean | null | undefined>

function escape(v: any): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportCSV(filename: string, rows: CSVRow[], headers?: string[]): void {
  if (typeof window === 'undefined') return
  if (!rows.length) {
    // still produce an empty file so the user sees feedback
    return _download(filename, (headers ?? []).join(',') + '\n')
  }
  const keys = headers ?? Object.keys(rows[0])
  const head = keys.map(escape).join(',')
  const body = rows.map(r => keys.map(k => escape(r[k])).join(',')).join('\n')
  _download(filename, `${head}\n${body}\n`)
}

function _download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function timestampedName(stem: string): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${stem}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}
