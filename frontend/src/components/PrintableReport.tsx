'use client';

import { useRef } from 'react';

interface PrintableReportProps {
  moduleName: string;
  result: unknown;
  textContent: string;
  timestamp: string;
}

export default function PrintableReport({
  moduleName,
  textContent,
  timestamp,
}: PrintableReportProps) {
  const printContent = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const escaped = textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>RegCheck-India — ${moduleName} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-box { width: 36px; height: 36px; background: #0d9488; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 16px; }
    .logo-text { font-weight: 700; font-size: 16px; color: #0f172a; }
    .meta { text-align: right; font-size: 11px; color: #64748b; }
    .module-badge { display: inline-block; background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-bottom: 20px; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 6px; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0d9488; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .content { white-space: pre-wrap; line-height: 1.7; color: #334155; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; }
    .disclaimer { margin-top: 32px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11px; color: #92400e; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-box">R</div>
      <span class="logo-text">RegCheck-India</span>
    </div>
    <div class="meta">
      <div>Generated: ${timestamp}</div>
      <div>AI-Assisted Regulatory Compliance Tool</div>
    </div>
  </div>
  <div class="module-badge">${moduleName}</div>
  <h1>Compliance Analysis Report</h1>
  <h2>Analysis Output</h2>
  <div class="content">${escaped}</div>
  <div class="disclaimer">
    <strong>⚠ Important Disclaimer:</strong> This report is AI-generated and must be reviewed
    and validated by a qualified Regulatory Affairs professional before use in any regulatory
    submission to CDSCO or any other regulatory authority. RegCheck-India is a compliance
    support tool and does not replace professional regulatory advice.
  </div>
  <div class="footer">
    <span>regcheckindia.com</span>
    <span>Confidential — For Internal Review Only</span>
    <span>Page 1</span>
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <button
      onClick={printContent}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
      title="Print or save as PDF"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Print / PDF
    </button>
  );
}
