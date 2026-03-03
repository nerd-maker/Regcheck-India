'use client';

import React, { useState } from 'react';

interface QueryClassification {
    primary_category: string;
    secondary_categories: string[];
    complexity: string;
    urgency: string;
    data_gap: string;
    data_gap_detail: string;
    recommended_template: string;
    classification_confidence: string;
    reasoning: string;
}

interface QueryResponse {
    response_text: string;
    commitments_made: string[];
    additional_info_needed: string[];
    confidence: string;
    reviewer_flags: string[];
    supporting_documents_referenced: string[];
}

export default function QueryResponseAssistant() {
    const [queryText, setQueryText] = useState<string>('');
    const [queryReference, setQueryReference] = useState<string>('');
    const [queryDate, setQueryDate] = useState<string>('');
    const [responseDeadline, setResponseDeadline] = useState<string>('');
    const [submissionType, setSubmissionType] = useState<string>('CT-04');
    const [submissionDate, setSubmissionDate] = useState<string>('');

    const [classification, setClassification] = useState<QueryClassification | null>(null);
    const [response, setResponse] = useState<QueryResponse | null>(null);
    const [isClassifying, setIsClassifying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string>('');
    const [activeView, setActiveView] = useState<'input' | 'classification' | 'response'>('input');

    const classifyQuery = async () => {
        if (!queryText.trim()) {
            setError('Please enter query text');
            return;
        }

        setIsClassifying(true);
        setError('');

        try {
            const res = await fetch('http://localhost:8000/api/query/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query_text: queryText,
                    query_reference: queryReference,
                    response_deadline: responseDeadline
                })
            });

            if (!res.ok) {
                throw new Error(`Classification failed: ${res.statusText}`);
            }

            const data = await res.json();
            setClassification(data);
            setActiveView('classification');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Classification failed');
        } finally {
            setIsClassifying(false);
        }
    };

    const generateResponse = async () => {
        if (!classification) {
            setError('Please classify the query first');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            const res = await fetch('http://localhost:8000/api/query/generate-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: {
                        query_text: queryText,
                        query_reference: queryReference,
                        query_date: queryDate,
                        response_deadline: responseDeadline,
                        submission_type: submissionType,
                        submission_date: submissionDate,
                        submission_documents: []
                    },
                    classification: classification,
                    auto_classify: false
                })
            });

            if (!res.ok) {
                throw new Error(`Response generation failed: ${res.statusText}`);
            }

            const data = await res.json();
            setResponse(data);
            setActiveView('response');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Response generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Query Response Assistant
                        </h1>
                        <p className="text-gray-600">
                            Automated drafting of responses to CDSCO deficiency letters and Ethics Committee queries
                        </p>
                    </div>

                    {/* View Tabs */}
                    <div className="flex gap-2 mb-8 border-b border-gray-200">
                        <button
                            onClick={() => setActiveView('input')}
                            className={`px-6 py-3 font-semibold transition-all ${activeView === 'input'
                                    ? 'border-b-2 border-green-600 text-green-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Query Input
                        </button>
                        <button
                            onClick={() => setActiveView('classification')}
                            disabled={!classification}
                            className={`px-6 py-3 font-semibold transition-all ${activeView === 'classification'
                                    ? 'border-b-2 border-green-600 text-green-600'
                                    : 'text-gray-500 hover:text-gray-700 disabled:text-gray-300'
                                }`}
                        >
                            Classification
                        </button>
                        <button
                            onClick={() => setActiveView('response')}
                            disabled={!response}
                            className={`px-6 py-3 font-semibold transition-all ${activeView === 'response'
                                    ? 'border-b-2 border-green-600 text-green-600'
                                    : 'text-gray-500 hover:text-gray-700 disabled:text-gray-300'
                                }`}
                        >
                            Generated Response
                        </button>
                    </div>

                    {/* Query Input View */}
                    {activeView === 'input' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Query Reference Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={queryReference}
                                        onChange={(e) => setQueryReference(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        placeholder="CDSCO/CT/2024/001/Q1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Submission Type
                                    </label>
                                    <select
                                        value={submissionType}
                                        onChange={(e) => setSubmissionType(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="CT-04">CT-04 (Clinical Trial)</option>
                                        <option value="ANDA">ANDA</option>
                                        <option value="IND">IND</option>
                                        <option value="NDA">NDA</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Query Date
                                    </label>
                                    <input
                                        type="date"
                                        value={queryDate}
                                        onChange={(e) => setQueryDate(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Response Deadline
                                    </label>
                                    <input
                                        type="date"
                                        value={responseDeadline}
                                        onChange={(e) => setResponseDeadline(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Original Submission Date
                                    </label>
                                    <input
                                        type="date"
                                        value={submissionDate}
                                        onChange={(e) => setSubmissionDate(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Query Text *
                                </label>
                                <textarea
                                    value={queryText}
                                    onChange={(e) => setQueryText(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    rows={8}
                                    placeholder="Paste the full query text from CDSCO or Ethics Committee..."
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={classifyQuery}
                                    disabled={isClassifying}
                                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isClassifying ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Classifying...
                                        </>
                                    ) : (
                                        'Classify Query'
                                    )}
                                </button>

                                {classification && (
                                    <button
                                        onClick={generateResponse}
                                        disabled={isGenerating}
                                        className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Generating Response...
                                            </>
                                        ) : (
                                            'Generate Response'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Classification View */}
                    {activeView === 'classification' && classification && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Primary Category</h3>
                                    <p className="text-lg font-bold text-blue-700">{classification.primary_category}</p>
                                </div>

                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                    <h3 className="text-sm font-semibold text-purple-900 mb-2">Complexity</h3>
                                    <p className={`text-lg font-bold ${classification.complexity === 'COMPLEX' ? 'text-red-700' :
                                            classification.complexity === 'MODERATE' ? 'text-yellow-700' :
                                                'text-green-700'
                                        }`}>
                                        {classification.complexity}
                                    </p>
                                </div>

                                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                    <h3 className="text-sm font-semibold text-orange-900 mb-2">Urgency</h3>
                                    <p className={`text-lg font-bold ${classification.urgency === 'HIGH' ? 'text-red-700' :
                                            classification.urgency === 'MEDIUM' ? 'text-yellow-700' :
                                                'text-green-700'
                                        }`}>
                                        {classification.urgency}
                                    </p>
                                </div>

                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <h3 className="text-sm font-semibold text-green-900 mb-2">Data Gap</h3>
                                    <p className={`text-lg font-bold ${classification.data_gap === 'NO' ? 'text-red-700' :
                                            classification.data_gap === 'PARTIAL' ? 'text-yellow-700' :
                                                'text-green-700'
                                        }`}>
                                        {classification.data_gap}
                                    </p>
                                </div>

                                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                                    <h3 className="text-sm font-semibold text-indigo-900 mb-2">Confidence</h3>
                                    <p className="text-lg font-bold text-indigo-700">{classification.classification_confidence}</p>
                                </div>

                                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                                    <h3 className="text-sm font-semibold text-teal-900 mb-2">Template</h3>
                                    <p className="text-sm font-medium text-teal-700">{classification.recommended_template}</p>
                                </div>
                            </div>

                            {classification.secondary_categories.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Secondary Categories</h3>
                                    <div className="flex gap-2">
                                        {classification.secondary_categories.map((cat, i) => (
                                            <span key={i} className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {classification.data_gap_detail && (
                                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                    <h3 className="text-sm font-semibold text-yellow-900 mb-2">Data Gap Details</h3>
                                    <p className="text-yellow-800">{classification.data_gap_detail}</p>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Classification Reasoning</h3>
                                <p className="text-gray-700">{classification.reasoning}</p>
                            </div>

                            <button
                                onClick={generateResponse}
                                disabled={isGenerating}
                                className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? 'Generating Response...' : 'Generate Response'}
                            </button>
                        </div>
                    )}

                    {/* Response View */}
                    {activeView === 'response' && response && (
                        <div className="space-y-6">
                            {/* Response Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className={`rounded-lg p-4 border ${response.confidence === 'HIGH' ? 'bg-green-50 border-green-200' :
                                        response.confidence === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-red-50 border-red-200'
                                    }`}>
                                    <h3 className="text-sm font-semibold mb-2">Response Confidence</h3>
                                    <p className="text-lg font-bold">{response.confidence}</p>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Commitments</h3>
                                    <p className="text-2xl font-bold text-blue-700">{response.commitments_made.length}</p>
                                </div>

                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                    <h3 className="text-sm font-semibold text-purple-900 mb-2">Reviewer Flags</h3>
                                    <p className="text-2xl font-bold text-purple-700">{response.reviewer_flags.length}</p>
                                </div>
                            </div>

                            {/* Response Text */}
                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Response</h3>
                                <div className="prose max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                                        {response.response_text}
                                    </pre>
                                </div>
                            </div>

                            {/* Commitments */}
                            {response.commitments_made.length > 0 && (
                                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                                    <h3 className="text-lg font-semibold text-blue-900 mb-4">Sponsor Commitments</h3>
                                    <ul className="space-y-2">
                                        {response.commitments_made.map((commitment, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                                    {i + 1}
                                                </span>
                                                <span className="text-blue-800">{commitment}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Additional Info Needed */}
                            {response.additional_info_needed.length > 0 && (
                                <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                                    <h3 className="text-lg font-semibold text-yellow-900 mb-4">Additional Information Needed</h3>
                                    <ul className="space-y-2">
                                        {response.additional_info_needed.map((info, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="text-yellow-600">⚠</span>
                                                <span className="text-yellow-800">{info}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Reviewer Flags */}
                            {response.reviewer_flags.length > 0 && (
                                <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                                    <h3 className="text-lg font-semibold text-red-900 mb-4">Reviewer Flags</h3>
                                    <ul className="space-y-2">
                                        {response.reviewer_flags.map((flag, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="text-red-600">🚩</span>
                                                <span className="text-red-800">{flag}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Supporting Documents */}
                            {response.supporting_documents_referenced.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Supporting Documents Referenced</h3>
                                    <ul className="space-y-1">
                                        {response.supporting_documents_referenced.map((doc, i) => (
                                            <li key={i} className="text-gray-700">• {doc}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 font-medium">Error: {error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
