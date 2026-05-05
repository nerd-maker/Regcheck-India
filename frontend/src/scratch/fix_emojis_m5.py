import sys
import re

path = r'C:\Users\Utkarsh\Desktop\pharma project\frontend\src\components\InspectionReportGenerator.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block
old_block = """            {[
              { value: 'text', label: 'âœ ï¸  Type / Paste Text' },
              { value: 'scan', label: '📄 Scanned Document (OCR)' },
              { value: 'handwritten', label: 'âœ ï¸  Handwritten Notes (AI Vision)' },
            ].map((mode) => (
              <button key={mode.value} onClick={() => setInputMode(mode.value as 'text' | 'scan' | 'handwritten')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${inputMode === mode.value ? 'bg-teal-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                {mode.label}
              </button>
            ))}"""

# Since direct string match might fail due to how Python reads 'âœ ï¸', 
# I will use a regex that matches the structure but ignores the specific emoji characters.

regex_pattern = r'            \{\[\s+\{ value: \'text\', label: \'.*? Type / Paste Text\' \},\s+\{ value: \'scan\', label: \'.*? Scanned Document \(OCR\)\' \},\s+\{ value: \'handwritten\', label: \'.*? Handwritten Notes \(AI Vision\)\' \},\s+\].map\(\(mode\) => \(\s+<button key=\{mode\.value\} onClick=\{\(\) => setInputMode\(mode\.value as \'text\' \| \'scan\' \| \'handwritten\'\)\} className=\{`px-4 py-2 rounded-xl text-sm font-medium transition-all \$\{inputMode === mode\.value \? \'bg-teal-600 text-white\' : \'bg-white/5 text-slate-400 hover:bg-white/10\'\}`\}>\s+\{mode\.label\}\s+</button>\s+\)\)'

# Wait, the above is too complex. I'll just use line numbers to identify the block and replace it.

lines = content.splitlines()
start_line = 151 # 0-indexed would be 150
end_line = 160 # 0-indexed would be 159

new_block = """          <div className="flex flex-wrap gap-2">
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

# Replace lines 151 to 161 (1-indexed)
# splitlines() removes the \n, so I'll join them back.

new_lines = lines[:150] + [new_block] + lines[161:]
final_content = '\n'.join(new_lines)

with open(path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Replacement successful for InspectionReportGenerator.tsx")
