import os
import re

FRONTEND_SRC = r'C:\Users\Utkarsh\Desktop\pharma project\frontend\src'

REPLACEMENTS = {
    'âœ ï¸ ': '', # Usually ✍️
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

# Mapping of specific emojis to SVG icons (as strings to be inserted into TSX)
# We'll only apply these to specific files or patterns where buttons/labels are used.
EMOJI_TO_SVG = {
    '📰': """<svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>""",
    '⚠️': """<svg className="w-4 h-4 inline-block mr-1 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>""",
    '📋': """<svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>""",
    '👤': """<svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>""",
    '📝': """<svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>""",
    '⚠️': """<svg className="w-5 h-5 inline-block mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>""",
}

def clean_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. Handle special cases with SVG injection
        for emoji, svg in EMOJI_TO_SVG.items():
            if emoji in content:
                # If the emoji is inside a label or heading, replace with SVG
                # We'll use a simple replacement for now, as context-aware injection is hard without a parser.
                # But since these are mostly in strings like "⚠️ Critical Blockers", it works.
                content = content.replace(emoji, svg)
        
        # 2. Handle generic artifacts
        for old, new in REPLACEMENTS.items():
            content = content.replace(old, new)
        
        # 3. Final cleanup of any remaining emojis (if any)
        # Regex for emojis
        emoji_regex = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
        content = emoji_regex.sub('', content)

        if content != original_content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error processing {path}: {e}")
    return False

def main():
    count = 0
    for root, dirs, files in os.walk(FRONTEND_SRC):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                if clean_file(os.path.join(root, file)):
                    print(f"Cleaned {file}")
                    count += 1
    print(f"Total files cleaned: {count}")

if __name__ == "__main__":
    main()
