/**
 * Impact Assessment Viewer Component
 * 
 * View impact assessments for submissions with action items and alerts.
 */

'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getSessionId } from '../utils/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface DocumentChange {
    document: string;
    affected_section: string;
    current_content_summary: string;
    required_change: string;
    change_urgency: 'BEFORE_NEXT_SUBMISSION' | 'WITHIN_30_DAYS' | 'MONITOR';
}

interface ActionItem {
    action: string;
    owner: 'Sponsor' | 'CRO' | 'Site' | 'RA Team' | 'Ethics Committee';
    deadline: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SubmissionImpactAssessment {
    submission_id: string;
    change_id: string;
    impact_status: 'IMPACTED' | 'LIKELY_IMPACTED' | 'MONITOR' | 'NOT_IMPACTED';
    impact_rationale: string;
    affected_documents: DocumentChange[];
    amendment_required: boolean;
    amendment_type: string | null;
    estimated_delay_risk: string;
    recommended_actions: ActionItem[];
    human_review_required: boolean;
    alert_text: string;
    assessment_date: string;
}

interface ActiveSubmission {
    submission_id: string;
    submission_type: string;
    drug_name: string;
    phase: string | null;
    status: string;
    current_stage: string;
}

export default function ImpactAssessmentViewer() {
    const [submissions, setSubmissions] = useState<ActiveSubmission[]>([]);
    const [selectedSubmission, setSelectedSubmission] = useState<string>('');
    const [changeId, setChangeId] = useState('');
    const [assessment, setAssessment] = useState<SubmissionImpactAssessment | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch submissions
    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/regulatory/submissions`, {
                headers: { 'X-Session-ID': getSessionId() }
            });

            const data = response.data;
            setSubmissions(data.submissions || []);
        } catch (err: any) {
            console.error('Failed to fetch submissions:', err);
        }
    };

    // Assess impact
    const assessImpact = async () => {
        if (!selectedSubmission || !changeId) {
            setError('Please select a submission and enter a change ID');
            return;
        }

        setLoading(true);
        setError('');
        setAssessment(null);

        try {
            const response = await axios.post(`${API_URL}/api/regulatory/assess-impact`, {
                change_id: changeId,
                submission_id: selectedSubmission,
                auto_generate_actions: true
            }, {
                headers: { 'X-Session-ID': getSessionId() }
            });

            const data = response.data;
            setAssessment(data.assessment);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Status color mapping
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'IMPACTED': return 'bg-red-100 text-red-800 border-red-300';
            case 'LIKELY_IMPACTED': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'MONITOR': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'NOT_IMPACTED': return 'bg-green-100 text-green-800 border-green-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'bg-red-100 text-red-800';
            case 'HIGH': return 'bg-orange-100 text-orange-800';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
            case 'LOW': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-2">🎯 Impact Assessment Viewer</h2>
                <p className="text-purple-100">Assess regulatory change impact on active submissions</p>
            </div>

            {/* Assessment Form */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Assess Impact</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Submission <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedSubmission}
                            onChange={(e) => setSelectedSubmission(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Select submission...</option>
                            {submissions.map((sub) => (
                                <option key={sub.submission_id} value={sub.submission_id}>
                                    {sub.submission_id} - {sub.drug_name} ({sub.submission_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Change ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={changeId}
                            onChange={(e) => setChangeId(e.target.value)}
                            placeholder="e.g., CHG-20260217-001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                <button
                    onClick={assessImpact}
                    disabled={loading || !selectedSubmission || !changeId}
                    className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? 'Assessing...' : 'Assess Impact'}
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
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="mt-2 text-gray-600">Analyzing impact...</p>
                </div>
            )}

            {/* Assessment Results */}
            {assessment && !loading && (
                <div className="space-y-6">
                    {/* Impact Status */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">Impact Status</h3>
                        <div className="flex items-center gap-4 mb-4">
                            <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(assessment.impact_status)}`}>
                                {assessment.impact_status.replace(/_/g, ' ')}
                            </span>
                            {assessment.amendment_required && (
                                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                                    Amendment Required: {assessment.amendment_type}
                                </span>
                            )}
                            {assessment.human_review_required && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                    👤 Human Review Required
                                </span>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <h4 className="font-medium text-gray-700">Impact Rationale</h4>
                                <p className="text-gray-600 mt-1">{assessment.impact_rationale}</p>
                            </div>

                            <div>
                                <h4 className="font-medium text-gray-700">Estimated Delay Risk</h4>
                                <p className="text-gray-600 mt-1">{assessment.estimated_delay_risk}</p>
                            </div>
                        </div>
                    </div>

                    {/* Alert */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex items-start">
                            <span className="text-2xl mr-3">⚠️</span>
                            <div>
                                <h4 className="font-semibold text-yellow-800 mb-1">Regulatory Alert</h4>
                                <p className="text-yellow-700">{assessment.alert_text}</p>
                            </div>
                        </div>
                    </div>

                    {/* Affected Documents */}
                    {assessment.affected_documents.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">Affected Documents ({assessment.affected_documents.length})</h3>
                            <div className="space-y-4">
                                {assessment.affected_documents.map((doc, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-gray-800">{doc.document}</h4>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${doc.change_urgency === 'BEFORE_NEXT_SUBMISSION' ? 'bg-red-100 text-red-800' :
                                                doc.change_urgency === 'WITHIN_30_DAYS' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {doc.change_urgency.replace(/_/g, ' ')}
                                            </span>
                                        </div>

                                        <div className="text-sm space-y-2">
                                            <div>
                                                <span className="font-medium text-gray-700">Section:</span>
                                                <span className="ml-2 text-gray-600">{doc.affected_section}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Current Content:</span>
                                                <p className="text-gray-600 mt-1">{doc.current_content_summary}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Required Change:</span>
                                                <p className="text-gray-600 mt-1 bg-blue-50 p-2 rounded">{doc.required_change}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended Actions */}
                    {assessment.recommended_actions.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">Recommended Actions ({assessment.recommended_actions.length})</h3>
                            <div className="space-y-3">
                                {assessment.recommended_actions.map((action, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-semibold">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(action.priority)}`}>
                                                    {action.priority}
                                                </span>
                                                <span className="text-sm text-gray-600">Owner: {action.owner}</span>
                                                <span className="text-sm text-gray-600">Deadline: {action.deadline}</span>
                                            </div>
                                            <p className="text-gray-700">{action.action}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>Assessment Date: {new Date(assessment.assessment_date).toLocaleString('en-IN')}</span>
                            <span>Change ID: {assessment.change_id}</span>
                            <span>Submission ID: {assessment.submission_id}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* No Submissions */}
            {submissions.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                    No active submissions found. Register submissions via the API to enable impact assessment.
                </div>
            )}
        </div>
    );
}
