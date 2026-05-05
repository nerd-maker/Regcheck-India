import os
import re

FRONTEND_SRC = r'C:\Users\Utkarsh\Desktop\pharma project\frontend\src'

M5_PATH = os.path.join(FRONTEND_SRC, 'components', 'InspectionReportGenerator.tsx')
M2_PATH = os.path.join(FRONTEND_SRC, 'components', 'DocumentSummariser.tsx')

def fix_m5():
    if not os.path.exists(M5_PATH): return
    with open(M5_PATH, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
    
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
    
    # Locate block between line 151 and 161 (approx)
    # The view_file output showed:
    # 151:           <div className="flex flex-wrap gap-2">
    # ...
    # 161:           </div>
    
    # We already did this in the previous script, but I'll make it part of this one for completeness.
    # Wait, I already ran the script for M5. I'll just check if it's already fixed.
    content = '\n'.join(lines)
    if 'Type / Paste Text' in content and 'icon:' in content:
        print("M5 already fixed or has icons.")
    else:
        new_lines = lines[:150] + [new_block] + lines[161:]
        content = '\n'.join(new_lines)
        with open(M5_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print("M5 icons added.")

def fix_m2():
    if not os.path.exists(M2_PATH): return
    with open(M2_PATH, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
    
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

    content = '\n'.join(lines)
    if 'Type / Paste Text' in content and 'icon:' in content:
        print("M2 already fixed or has icons.")
    else:
        new_lines = lines[:214] + [new_block] + lines[233:]
        content = '\n'.join(new_lines)
        with open(M2_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print("M2 icons added.")

def fix_general_artifacts():
    replacements = {
        'âœ ï¸ ': '',
        '📄': '',
        'âš ': '⚠',
        'Â·': '·',
        'â€¢': '•',
        'â€”': '—',
        'ðŸ': '',
        'âce': '',
        'â€': '',
        'Ì¸': '',
    }
    
    for root, dirs, files in os.walk(FRONTEND_SRC):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original_content = content
                    for old, new in replacements.items():
                        content = content.replace(old, new)
                    
                    if content != original_content:
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Cleaned artifacts in {file}")
                except Exception as e:
                    print(f"Error processing {file}: {e}")

if __name__ == "__main__":
    fix_m5()
    fix_m2()
    fix_general_artifacts()
    print("Cleanup complete.")
