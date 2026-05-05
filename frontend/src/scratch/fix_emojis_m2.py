import sys

path = r'C:\Users\Utkarsh\Desktop\pharma project\frontend\src\components\DocumentSummariser.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# Replace Input Method block (lines 215-233 approx)
start_line = 215 # 0-indexed would be 214
end_line = 233 # 0-indexed would be 232

new_block = """              <div className="flex flex-wrap gap-2">
                {[
                  {
                    value: 'text',
                    label: 'Type / Paste Text',
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    )
                  },
                  {
                    value: 'scan',
                    label: 'Scanned Document (OCR)',
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    )
                  },
                  {
                    value: 'handwritten',
                    label: 'Handwritten Notes (AI Vision)',
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                      </svg>
                    )
                  },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setInputMode(mode.value as 'text' | 'scan' | 'handwritten')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      inputMode === mode.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {mode.icon}
                    {mode.label}
                  </button>
                ))}
              </div>"""

new_lines = lines[:214] + [new_block] + lines[233:]
final_content = '\n'.join(new_lines)

with open(path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Replacement successful for DocumentSummariser.tsx")
