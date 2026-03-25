'use client';

import React, { useState } from 'react';
import { EvaluationResponse, Finding } from '@/services/api';

interface ResultsViewerProps {
    evaluation: EvaluationResponse;
}

export default function ResultsViewer({ evaluation }: ResultsViewerProps) {
    const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

    const toggleFinding = (findingId: string) => {
        const newExpanded = new Set(expandedFindings);
        if (newExpanded.has(findingId)) {
            newExpanded.delete(findingId);
        } else {
            newExpanded.add(findingId);
        }
        setExpandedFindings(newExpanded);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PASS': return 'bg-status-pass text-white';
            case 'PARTIAL': return 'bg-status-partial text-white';
            case 'FAIL': return 'bg-status-fail text-white';
            case 'UNVERIFIED': return 'bg-status-unverified text-white';
            default: return 'bg-status-na text-white';
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'HIGH': return 'bg-risk-high text-white';
            case 'MEDIUM': return 'bg-risk-medium text-white';
            case 'LOW': return 'bg-risk-low text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const exportToJSON = () => {
        const dataStr = JSON.stringify(evaluation, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `evaluation_${evaluation.evaluation_id}.json`;
        link.click();
    };

    const exportToHTML = () => {
        const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        const statusColor = (status: string) => {
            switch (status) {
                case 'PASS': return '#16a34a';
                case 'PARTIAL': return '#d97706';
                case 'FAIL': return '#dc2626';
                default: return '#6b7280';
            }
        };

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>RegCheck-India Compliance Report</title>
<style>
body { font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 40px; color: #1f2937; background: #fff; }
.header { text-align: center; border-bottom: 3px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px; }
.header h1 { color: #0A1628; margin: 0 0 8px 0; font-size: 24px; }
.header p { color: #6b7280; margin: 4px 0; font-size: 13px; }
.summary { display: flex; gap: 16px; margin-bottom: 24px; }
.summary-card { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
.summary-card h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin: 0 0 8px 0; letter-spacing: 0.5px; }
.summary-card .value { font-size: 18px; font-weight: 700; }
.findings-count { display: flex; gap: 12px; margin-bottom: 24px; justify-content: center; }
.count-badge { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.finding { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
.finding-header { padding: 12px 16px; display: flex; align-items: center; gap: 12px; background: #f9fafb; }
.finding-badge { padding: 3px 10px; border-radius: 12px; color: white; font-size: 11px; font-weight: 700; }
.finding-body { padding: 16px; font-size: 13px; line-height: 1.6; }
.finding-body strong { display: block; font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 12px 0 4px 0; letter-spacing: 0.3px; }
.finding-body strong:first-child { margin-top: 0; }
.remediation { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; color: #166534; }
.blockers { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
.blockers h3 { color: #991b1b; margin: 0 0 8px 0; font-size: 14px; }
.blockers li { color: #dc2626; font-size: 13px; margin-bottom: 4px; }
.footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
@media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
<h1>RegCheck-India Compliance Report</h1>
<p>Evaluation ID: ${evaluation.evaluation_id} | Generated: ${date}</p>
</div>
<div class="summary">
<div class="summary-card" style="background:#f0f9ff"><h3>Overall Status</h3><div class="value" style="color:${statusColor(evaluation.overall_status)}">${evaluation.overall_status}</div></div>
<div class="summary-card" style="background:#fef3c7"><h3>Risk Level</h3><div class="value">${evaluation.overall_risk}</div></div>
<div class="summary-card" style="background:#f0fdf4"><h3>Confidence</h3><div class="value">${evaluation.confidence_level}</div></div>
</div>
<div class="findings-count">
<span class="count-badge" style="background:#dc2626;color:white">${evaluation.findings_by_status.FAIL} Failed</span>
<span class="count-badge" style="background:#d97706;color:white">${evaluation.findings_by_status.PARTIAL} Partial</span>
<span class="count-badge" style="background:#16a34a;color:white">${evaluation.findings_by_status.PASS} Passed</span>
<span class="count-badge" style="background:#6b7280;color:white">${evaluation.findings_by_status.UNVERIFIED} Unverified</span>
</div>
${evaluation.critical_blockers.length > 0 ? `<div class="blockers"><h3>⚠ Critical Blockers</h3><ul>${evaluation.critical_blockers.map(b => `<li>${b}</li>`).join('')}</ul></div>` : ''}
<h2 style="font-size:16px;margin-bottom:16px">Detailed Findings (${evaluation.total_findings})</h2>
${evaluation.findings.map(f => `
<div class="finding">
<div class="finding-header">
<span class="finding-badge" style="background:${statusColor(f.status)}">${f.status}</span>
<span style="font-size:13px;font-weight:600;color:#374151">${f.finding_id}</span>
<span style="font-size:13px;color:#6b7280">${f.section}</span>
</div>
<div class="finding-body">
<strong>Requirement</strong>${f.requirement}
<strong>Citation</strong><span style="color:#2563EB;font-family:monospace;font-size:12px">${f.citation}</span>
${f.gap ? `<strong>Gap Analysis</strong><span style="color:#dc2626">${f.gap}</span>` : ''}
${f.recommended_language ? `<strong>Recommended Language</strong><div class="remediation">${f.recommended_language}</div>` : ''}
</div></div>`).join('')}
<div class="footer">
<p>RegCheck-India v1.0.0 | AI-Powered Pharmaceutical Regulatory Compliance</p>
<p>⚠ This is a pilot tool. All outputs must be reviewed by qualified regulatory professionals.</p>
</div>
</body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compliance_report_${evaluation.evaluation_id}.html`;
        link.click();
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Evaluation Results</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Evaluation ID: {evaluation.evaluation_id}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={exportToHTML}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5 text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Report
                    </button>
                    <button
                        onClick={exportToJSON}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                        Export JSON
                    </button>
                </div>
            </div>

            {/* Overall Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Overall Status</p>
                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(evaluation.overall_status)}`}>
                        {evaluation.overall_status}
                    </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Risk Level</p>
                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getRiskColor(evaluation.overall_risk)}`}>
                        {evaluation.overall_risk}
                    </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Confidence</p>
                    <span className="inline-block px-4 py-2 rounded-full text-sm font-semibold bg-secondary text-white">
                        {evaluation.confidence_level}
                    </span>
                </div>
            </div>

            {/* Findings Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Findings Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-status-fail">{evaluation.findings_by_status.FAIL}</p>
                        <p className="text-sm text-gray-600">Failed</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-status-partial">{evaluation.findings_by_status.PARTIAL}</p>
                        <p className="text-sm text-gray-600">Partial</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-status-pass">{evaluation.findings_by_status.PASS}</p>
                        <p className="text-sm text-gray-600">Passed</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-status-unverified">{evaluation.findings_by_status.UNVERIFIED}</p>
                        <p className="text-sm text-gray-600">Unverified</p>
                    </div>
                </div>
            </div>

            {/* Critical Blockers */}
            {evaluation.critical_blockers.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <h3 className="font-semibold text-red-800 mb-2">⚠️ Critical Blockers</h3>
                    <ul className="list-disc list-inside space-y-1">
                        {evaluation.critical_blockers.map((blocker, idx) => (
                            <li key={idx} className="text-sm text-red-700">{blocker}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Missing Sections */}
            {evaluation.missing_sections.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                    <h3 className="font-semibold text-yellow-800 mb-2">📋 Missing Sections</h3>
                    <ul className="list-disc list-inside space-y-1">
                        {evaluation.missing_sections.map((section, idx) => (
                            <li key={idx} className="text-sm text-yellow-700">{section}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Detailed Findings */}
            <div>
                <h3 className="font-semibold text-gray-800 mb-3">Detailed Findings ({evaluation.total_findings})</h3>
                <div className="space-y-3">
                    {evaluation.findings.map((finding) => (
                        <div key={finding.finding_id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div
                                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleFinding(finding.finding_id)}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(finding.status)}`}>
                                        {finding.status}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">{finding.finding_id}</span>
                                    <span className="text-sm text-gray-600">{finding.section}</span>
                                    {finding.human_review_required && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                                            👤 Human Review
                                        </span>
                                    )}
                                </div>
                                <svg
                                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedFindings.has(finding.finding_id) ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            {expandedFindings.has(finding.finding_id) && (
                                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Requirement</p>
                                        <p className="text-sm text-gray-800">{finding.requirement}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Citation</p>
                                        <p className="text-sm text-blue-600 font-mono">{finding.citation}</p>
                                    </div>

                                    {finding.current_text && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Current Text</p>
                                            <p className="text-sm text-gray-700 italic">&quot;{finding.current_text}&quot;</p>
                                        </div>
                                    )}

                                    {finding.gap && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Gap Analysis</p>
                                            <p className="text-sm text-red-700">{finding.gap}</p>
                                        </div>
                                    )}

                                    {finding.recommended_language && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Recommended Language</p>
                                            <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{finding.recommended_language}</p>
                                        </div>
                                    )}

                                    {finding.human_review_required && finding.human_review_reason && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Human Review Reason</p>
                                            <p className="text-sm text-purple-700">{finding.human_review_reason}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Evaluator Notes */}
            {evaluation.evaluator_notes && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <h3 className="font-semibold text-blue-800 mb-2">📝 Evaluator Notes</h3>
                    <p className="text-sm text-blue-700">{evaluation.evaluator_notes}</p>
                </div>
            )}

            {/* Confidence Rationale */}
            <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">Confidence Rationale</h3>
                <p className="text-sm text-gray-700">{evaluation.confidence_rationale}</p>
            </div>
        </div>
    );
}
