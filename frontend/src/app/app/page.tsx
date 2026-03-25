'use client';

import React, { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import MetadataForm from '@/components/MetadataForm';
import ResultsViewer from '@/components/ResultsViewer';
import DocumentGenerator from '@/components/DocumentGenerator';
import QueryResponseAssistant from '@/components/QueryResponseAssistant';
import ChangeMonitorDashboard from '@/components/ChangeMonitorDashboard';
import ImpactAssessmentViewer from '@/components/ImpactAssessmentViewer';
import DigestViewer from '@/components/DigestViewer';
import { api, DocumentMetadata, EvaluationResponse } from '@/services/api';

type Module = 'compliance' | 'generator' | 'query' | 'regulatory';

export default function Home() {
    const [activeModule, setActiveModule] = useState<Module>('compliance');

    // Module 01 state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileId, setFileId] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<DocumentMetadata>({
        document_type: '',
        sponsor_name: '',
        drug_name: '',
        inn: '',
        trial_phase: '',
        submission_target: '',
        version: '',
        date: '',
    });
    const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    const handleFileSelect = async (file: File) => {
        setSelectedFile(file);
        setFileId(null);
        setEvaluation(null);
        setError(null);
        setUploadProgress('Uploading document...');

        try {
            const response = await api.uploadDocument(file);
            setFileId(response.file_id);
            setUploadProgress('Document uploaded successfully!');
            setTimeout(() => setUploadProgress(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to upload document');
            setUploadProgress('');
        }
    };

    const handleEvaluate = async () => {
        if (!fileId) {
            setError('Please upload a document first');
            return;
        }

        if (!metadata.document_type || !metadata.sponsor_name || !metadata.drug_name ||
            !metadata.trial_phase || !metadata.submission_target) {
            setError('Please fill in all required fields (marked with *)');
            return;
        }

        setLoading(true);
        setError(null);
        setEvaluation(null);

        try {
            const result = await api.evaluateDocument(fileId, metadata);
            setEvaluation(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to evaluate document');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setFileId(null);
        setMetadata({
            document_type: '',
            sponsor_name: '',
            drug_name: '',
            inn: '',
            trial_phase: '',
            submission_target: '',
            version: '',
            date: '',
        });
        setEvaluation(null);
        setError(null);
        setUploadProgress('');
    };

    const modules = [
        {
            id: 'compliance' as Module,
            name: 'Compliance Checker',
            icon: '✓',
            description: 'Evaluate documents for regulatory compliance',
            color: 'blue'
        },
        {
            id: 'generator' as Module,
            name: 'Document Generator',
            icon: '📄',
            description: 'Generate regulatory documents section-by-section',
            color: 'indigo'
        },
        {
            id: 'query' as Module,
            name: 'Query Response',
            icon: '💬',
            description: 'Draft responses to CDSCO queries',
            color: 'green'
        },
        {
            id: 'regulatory' as Module,
            name: 'Regulatory Intelligence',
            icon: '📊',
            description: 'Monitor CDSCO changes and assess impact',
            color: 'emerald'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                RegCheck-India
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                AI-Powered Pharmaceutical Regulatory Platform for Indian Submissions
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                Powered by Claude AI
                            </span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                v1.0.0
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Module Navigation */}
            <nav className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-2 overflow-x-auto py-4">
                        {modules.map(module => (
                            <button
                                key={module.id}
                                onClick={() => setActiveModule(module.id)}
                                className={`flex-shrink-0 px-6 py-3 rounded-lg font-semibold transition-all ${activeModule === module.id
                                    ? `bg-${module.color}-600 text-white shadow-lg scale-105`
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                style={activeModule === module.id ? {
                                    backgroundColor: module.color === 'blue' ? '#2563eb' :
                                        module.color === 'indigo' ? '#4f46e5' :
                                            module.color === 'purple' ? '#9333ea' :
                                                '#059669'
                                } : {}}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{module.icon}</span>
                                    <div className="text-left">
                                        <div className="font-bold">{module.name}</div>
                                        <div className="text-xs opacity-90">{module.description}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Module 01: Compliance Checker */}
                {activeModule === 'compliance' && (
                    <div className="space-y-6">
                        {/* Info Banner */}
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-blue-700">
                                        <strong>Important:</strong> This is a quality assurance tool for regulatory compliance evaluation.
                                        All outputs should be reviewed by qualified regulatory professionals.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Upload Section */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Step 1: Upload Document</h2>
                            <DocumentUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
                            {uploadProgress && (
                                <p className="mt-2 text-sm text-green-600">{uploadProgress}</p>
                            )}
                        </div>

                        {/* Metadata Section */}
                        {fileId && (
                            <div>
                                <MetadataForm metadata={metadata} onChange={setMetadata} />
                            </div>
                        )}

                        {/* Evaluate Button */}
                        {fileId && (
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={handleEvaluate}
                                    disabled={loading}
                                    className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Evaluating...
                                        </span>
                                    ) : (
                                        'Evaluate Document'
                                    )}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-8 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                                >
                                    Reset
                                </button>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Results Section */}
                        {evaluation && (
                            <div>
                                <ResultsViewer evaluation={evaluation} />
                            </div>
                        )}
                    </div>
                )}

                {/* Module 02: Document Generator */}
                {activeModule === 'generator' && <DocumentGenerator />}

                {/* Module 03: Query Response */}
                {activeModule === 'query' && <QueryResponseAssistant />}

                {/* Module 04: Regulatory Intelligence */}
                {activeModule === 'regulatory' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">Regulatory Intelligence Monitor</h3>
                            <p className="text-gray-600 mb-4">
                                Select a view to monitor CDSCO regulatory changes, assess impact on submissions, or generate weekly digests.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveModule('regulatory')}
                                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-md font-medium"
                                >
                                    Change Monitor
                                </button>
                            </div>
                        </div>

                        {/* Tabbed Interface for Module 04 */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="border-b border-gray-200">
                                <nav className="flex -mb-px">
                                    <button className="px-6 py-3 border-b-2 border-emerald-600 text-emerald-600 font-medium">
                                        Change Monitor
                                    </button>
                                    <button className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium">
                                        Impact Assessment
                                    </button>
                                    <button className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium">
                                        Weekly Digest
                                    </button>
                                </nav>
                            </div>
                            <div className="p-6">
                                <ChangeMonitorDashboard />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="text-center text-sm text-gray-600">
                        <p>RegCheck-India v1.0.0 | Specialized AI for Indian Pharmaceutical Regulatory Compliance</p>
                        <p className="mt-1">Evaluates against NDCTR 2019, CDSCO Guidelines, ICH E6(R3), Schedule Y, and CTRI Requirements</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
