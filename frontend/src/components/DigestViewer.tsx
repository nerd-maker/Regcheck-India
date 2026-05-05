/**
 * Digest Viewer Component
 * 
 * View and export weekly regulatory intelligence digests.
 */

'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { getSessionId } from '../utils/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface CriticalAction {
    deadline: string;
    action: string;
    affected_parties: string;
    change_id: string;
}

interface DetailedChange {
    change_title: string;
    effective_date: string;
    affects: string;
    what_to_do: string;
    source_citation: string;
    urgency: string;
}

interface WeeklyDigest {
    period_start: string;
    period_end: string;
    new_documents_detected: number;
    changes_extracted: number;
    critical_high_urgency_changes: number;
    executive_summary: string;
    critical_actions: CriticalAction[];
    detailed_changes: DetailedChange[];
    monitoring_items: string[];
    active_submissions_impacted: number;
    no_material_changes: boolean;
    generated_date: string;
}

export default function DigestViewer() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [includeLowUrgency, setIncludeLowUrgency] = useState(false);
    const [digest, setDigest] = useState<WeeklyDigest | null>(null);
    const [textExport, setTextExport] = useState('');
    const [markdownExport, setMarkdownExport] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'formatted' | 'text' | 'markdown'>('formatted');

    // Generate digest
    const generateDigest = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }

        setLoading(true);
        setError('');
        setDigest(null);

        try {
            const response = await axios.post(`${API_URL}/api/regulatory/generate-digest`, {
                start_date: startDate,
                end_date: endDate,
                include_low_urgency: includeLowUrgency
            }, {
                headers: { 'X-Session-ID': getSessionId() }
            });

            const data = response.data;
            setDigest(data.digest);
            setTextExport(data.exports.text);
            setMarkdownExport(data.exports.markdown);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    // Download as file
    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-2"><svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg> Weekly Regulatory Digest</h2>
                <p className="text-blue-100">Generate professional RA team digests</p>
            </div>

            {/* Generation Form */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Generate Digest</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-end">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={includeLowUrgency}
                                onChange={(e) => setIncludeLowUrgency(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Include low urgency changes</span>
                        </label>
                    </div>
                </div>

                <button
                    onClick={generateDigest}
                    disabled={loading || !startDate || !endDate}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? 'Generating...' : 'Generate Digest'}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Generating digest...</p>
                </div>
            )}

            {/* Digest Results */}
            {digest && !loading && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <div className="text-sm text-gray-600">New Documents</div>
                            <div className="text-2xl font-bold text-blue-600">{digest.new_documents_detected}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
                            <div className="text-sm text-gray-600">Changes Extracted</div>
                            <div className="text-2xl font-bold text-purple-600">{digest.changes_extracted}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                            <div className="text-sm text-gray-600">Critical/High</div>
                            <div className="text-2xl font-bold text-red-600">{digest.critical_high_urgency_changes}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
                            <div className="text-sm text-gray-600">Impacted Submissions</div>
                            <div className="text-2xl font-bold text-orange-600">{digest.active_submissions_impacted}</div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="border-b border-gray-200">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('formatted')}
                                    className={`px-6 py-3 font-medium ${activeTab === 'formatted'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Formatted View
                                </button>
                                <button
                                    onClick={() => setActiveTab('text')}
                                    className={`px-6 py-3 font-medium ${activeTab === 'text'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Text Export
                                </button>
                                <button
                                    onClick={() => setActiveTab('markdown')}
                                    className={`px-6 py-3 font-medium ${activeTab === 'markdown'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Markdown Export
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Formatted View */}
                            {activeTab === 'formatted' && (
                                <div className="space-y-6">
                                    {/* Executive Summary */}
                                    <div>
                                        <h3 className="text-xl font-bold mb-3">Executive Summary</h3>
                                        <p className="text-gray-700 leading-relaxed">{digest.executive_summary}</p>
                                    </div>

                                    {/* Critical Actions */}
                                    {digest.critical_actions.length > 0 && (
                                        <div>
                                            <h3 className="text-xl font-bold mb-3 text-red-600">Critical Actions Required</h3>
                                            <div className="space-y-3">
                                                {digest.critical_actions.map((action, idx) => (
                                                    <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-4">
                                                        <div className="font-semibold text-red-800 mb-1">
                                                            [DEADLINE: {action.deadline}]
                                                        </div>
                                                        <div className="text-gray-700">{action.action}</div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            Affected: {action.affected_parties}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Detailed Changes */}
                                    {digest.detailed_changes.length > 0 && (
                                        <div>
                                            <h3 className="text-xl font-bold mb-3">Detailed Change Log</h3>
                                            <div className="space-y-4">
                                                {digest.detailed_changes.map((change, idx) => (
                                                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-semibold text-lg">{change.change_title}</h4>
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${change.urgency === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                                                change.urgency === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                                                    change.urgency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-green-100 text-green-800'
                                                                }`}>
                                                                {change.urgency}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div>
                                                                <span className="font-medium text-gray-700">Effective:</span>
                                                                <span className="ml-2 text-gray-600">{change.effective_date}</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-gray-700">Affects:</span>
                                                                <span className="ml-2 text-gray-600">{change.affects}</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-gray-700">What to Do:</span>
                                                                <p className="text-gray-600 mt-1">{change.what_to_do}</p>
                                                            </div>
                                                            <div>
                                                                <span className="font-medium text-gray-700">Source:</span>
                                                                <p className="text-gray-600 mt-1 italic">{change.source_citation}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Monitoring Items */}
                                    {digest.monitoring_items.length > 0 && (
                                        <div>
                                            <h3 className="text-xl font-bold mb-3">Changes to Monitor</h3>
                                            <ul className="list-disc list-inside space-y-2">
                                                {digest.monitoring_items.map((item, idx) => (
                                                    <li key={idx} className="text-gray-700">{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* No Changes */}
                                    {digest.no_material_changes && (
                                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                                            No material regulatory changes were published by CDSCO or MOHFW during this period.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text Export */}
                            {activeTab === 'text' && (
                                <div>
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => copyToClipboard(textExport)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                        >
                                            Copy to Clipboard
                                        </button>
                                        <button
                                            onClick={() => downloadFile(textExport, `digest_${digest.period_start}_${digest.period_end}.txt`)}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                        >
                                            Download as TXT
                                        </button>
                                    </div>
                                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                                        {textExport}
                                    </pre>
                                </div>
                            )}

                            {/* Markdown Export */}
                            {activeTab === 'markdown' && (
                                <div>
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => copyToClipboard(markdownExport)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                        >
                                            Copy to Clipboard
                                        </button>
                                        <button
                                            onClick={() => downloadFile(markdownExport, `digest_${digest.period_start}_${digest.period_end}.md`)}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                        >
                                            Download as MD
                                        </button>
                                    </div>
                                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                                        {markdownExport}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>Period: {digest.period_start} to {digest.period_end}</span>
                            <span>Generated: {new Date(digest.generated_date).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
