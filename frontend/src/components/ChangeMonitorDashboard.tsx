/**
 * Change Monitor Dashboard Component
 * 
 * Displays regulatory changes in a timeline view with filtering and detail cards.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getSessionId } from '../utils/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface RegulatoryChange {
    change_id: string;
    domain: string;
    change_type: string;
    previous_requirement: string;
    new_requirement: string;
    effective_date: string;
    transition_provisions: string;
    affected_submission_types: string[];
    affected_product_categories: string[];
    source_section: string;
    verbatim_text: string;
    source_citation: string;
    source_url?: string;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    urgency_rationale: string;
    action_window: string;
    recommended_action: string;
    plain_language_summary: string;
    detected_date: string;
}

interface ChangeListResponse {
    total_changes: number;
    changes: RegulatoryChange[];
    filters_applied: Record<string, any>;
}

interface ChangeFilters {
    domain?: string;
    urgency?: string;
    startDate?: string;
    endDate?: string;
}

export default function ChangeMonitorDashboard() {
    const [changes, setChanges] = useState<RegulatoryChange[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedChange, setSelectedChange] = useState<RegulatoryChange | null>(null);

    // Filters
    const [domainFilter, setDomainFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Stats
    const [stats, setStats] = useState({
        total_changes: 0,
        critical_changes: 0,
        high_urgency_changes: 0
    });

    // Fetch changes
    const fetchChanges = useCallback(async (filters?: ChangeFilters) => {
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            const domain = filters?.domain ?? domainFilter;
            const urgency = filters?.urgency ?? urgencyFilter;
            const start = filters?.startDate ?? startDate;
            const end = filters?.endDate ?? endDate;

            if (domain) params.append('domain', domain);
            if (urgency) params.append('urgency', urgency);
            if (start) params.append('start_date', start);
            if (end) params.append('end_date', end);

            const response = await axios.get(`${API_URL}/api/regulatory/changes`, {
                params: Object.fromEntries(params),
                headers: { 'X-Session-ID': getSessionId() }
            });

            const data: ChangeListResponse = response.data;
            setChanges(data.changes);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [domainFilter, urgencyFilter, startDate, endDate]);

    // Fetch stats
    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/regulatory/stats`, {
                headers: { 'X-Session-ID': getSessionId() }
            });

            const data = response.data;
            setStats(data);
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
        }
    };

    // Initial load
    useEffect(() => {
        fetchChanges();
        fetchStats();
    }, [fetchChanges]);

    // Urgency color mapping
    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        if (dateString === 'IMMEDIATE' || dateString === 'UNCLEAR') return dateString;
        try {
            return new Date(dateString).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-2">📊 Regulatory Intelligence Monitor</h2>
                <p className="text-emerald-100">Track CDSCO/MOHFW regulatory changes and assess impact</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="text-sm text-gray-600">Total Changes</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.total_changes}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                    <div className="text-sm text-gray-600">Critical Changes</div>
                    <div className="text-2xl font-bold text-red-600">{stats.critical_changes}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
                    <div className="text-sm text-gray-600">High Urgency</div>
                    <div className="text-2xl font-bold text-orange-600">{stats.high_urgency_changes}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                        <input
                            type="text"
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            placeholder="e.g., Clinical Trial Conduct"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                        <select
                            value={urgencyFilter}
                            onChange={(e) => setUrgencyFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">All</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={() => {
                            fetchChanges();
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                    >
                        Apply Filters
                    </button>
                    <button
                        onClick={() => {
                            setDomainFilter('');
                            setUrgencyFilter('');
                            setStartDate('');
                            setEndDate('');
                            fetchChanges({
                                domain: '',
                                urgency: '',
                                startDate: '',
                                endDate: '',
                            });
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
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
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <p className="mt-2 text-gray-600">Loading changes...</p>
                </div>
            )}

            {/* Changes Timeline */}
            {!loading && changes.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Regulatory Changes ({changes.length})</h3>
                    {changes.map((change) => (
                        <div
                            key={change.change_id}
                            className={`bg-white p-6 rounded-lg shadow border-l-4 cursor-pointer hover:shadow-lg transition-shadow ${change.urgency === 'CRITICAL' ? 'border-red-500' :
                                change.urgency === 'HIGH' ? 'border-orange-500' :
                                    change.urgency === 'MEDIUM' ? 'border-yellow-500' :
                                        'border-green-500'
                                }`}
                            onClick={() => setSelectedChange(change)}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getUrgencyColor(change.urgency)}`}>
                                            {change.urgency}
                                        </span>
                                        <span className="text-sm text-gray-600">{change.domain}</span>
                                    </div>
                                    <h4 className="font-semibold text-lg">{change.change_type.replace(/_/g, ' ')}</h4>
                                </div>
                                <div className="text-right text-sm text-gray-600">
                                    <div>Detected: {formatDate(change.detected_date)}</div>
                                    <div>Effective: {formatDate(change.effective_date)}</div>
                                </div>
                            </div>

                            {/* Summary */}
                            <p className="text-gray-700 mb-3">{change.plain_language_summary}</p>

                            {/* Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700">Affected Types:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {change.affected_submission_types.map((type, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Action Window:</span>
                                    <span className="ml-2 text-gray-600">{change.action_window}</span>
                                </div>
                            </div>

                            {/* Recommended Action */}
                            <div className="mt-3 p-3 bg-emerald-50 rounded border border-emerald-200">
                                <span className="font-medium text-emerald-800">Recommended Action:</span>
                                <p className="text-emerald-700 mt-1">{change.recommended_action}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* No Results */}
            {!loading && changes.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">No regulatory changes found matching your filters.</p>
                </div>
            )}

            {/* Change Detail Modal */}
            {selectedChange && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            {/* Modal Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold">{selectedChange.change_id}</h3>
                                    <p className="text-gray-600">{selectedChange.domain}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedChange(null)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-gray-700">Change Type</h4>
                                    <p className="text-gray-600">{selectedChange.change_type.replace(/_/g, ' ')}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">Previous Requirement</h4>
                                    <p className="text-gray-600">{selectedChange.previous_requirement}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">New Requirement</h4>
                                    <p className="text-gray-600">{selectedChange.new_requirement}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">Transition Provisions</h4>
                                    <p className="text-gray-600">{selectedChange.transition_provisions}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">Verbatim Text</h4>
                                    <p className="text-gray-600 italic bg-gray-50 p-3 rounded">{selectedChange.verbatim_text}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">Source Citation</h4>
                                    <p className="text-gray-600">{selectedChange.source_citation}</p>
                                    {selectedChange.source_url && (
                                        <a href={selectedChange.source_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                                            View Source Document →
                                        </a>
                                    )}
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700">Urgency Rationale</h4>
                                    <p className="text-gray-600">{selectedChange.urgency_rationale}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
