'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { getSessionId } from '../utils/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StudyData {
    study_title: string;
    protocol_number: string;
    phase: string;
    indication: string;
    imp_name: string;
    imp_dose: string;
    imp_route: string;
    comparator_name?: string;
    design_type: string;
    blinding: string;
    randomization: string;
    sample_size: number;
    duration: string;
    site_count: number;
    countries: string[];
    primary_endpoint: string;
    secondary_endpoints: string[];
    inclusion_criteria: string[];
    exclusion_criteria: string[];
    age_range: string;
    sponsor_name: string;
}

interface GeneratedSection {
    section_number: string;
    section_title: string;
    generated_content: string;
    placeholders: string[];
    completion_percentage: number;
    review_priority: string;
}

export default function DocumentGenerator() {
    const [documentType, setDocumentType] = useState<string>('protocol');
    const [studyData, setStudyData] = useState<Partial<StudyData>>({
        countries: ['India'],
        secondary_endpoints: [],
        inclusion_criteria: [],
        exclusion_criteria: [],
        randomization: '1:1 ratio',
        site_count: 1,
        age_range: '18-65 years',
    });
    const [generatedSections, setGeneratedSections] = useState<GeneratedSection[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string>('');
    const [currentStep, setCurrentStep] = useState<number>(1);

    const handleInputChange = (field: keyof StudyData, value: any) => {
        setStudyData(prev => ({ ...prev, [field]: value }));
    };

    const handleArrayInput = (field: keyof StudyData, value: string) => {
        const items = value.split('\n').filter(item => item.trim());
        setStudyData(prev => ({ ...prev, [field]: items }));
    };

    const generateDocument = async () => {
        setIsGenerating(true);
        setError('');
        setGeneratedSections([]);

        try {
            // Build complete payload with defaults for any missing required fields
            const completeStudyData = {
                study_title: studyData.study_title || 'Untitled Study',
                protocol_number: studyData.protocol_number || 'DRAFT-001',
                phase: studyData.phase || 'III',
                indication: studyData.indication || '',
                imp_name: studyData.imp_name || '',
                imp_dose: studyData.imp_dose || '',
                imp_route: studyData.imp_route || 'oral',
                design_type: studyData.design_type || 'Parallel group',
                blinding: studyData.blinding || 'Double-blind',
                randomization: studyData.randomization || '1:1 ratio',
                sample_size: studyData.sample_size || 100,
                duration: studyData.duration || '12 weeks',
                site_count: studyData.site_count || 1,
                countries: studyData.countries?.length ? studyData.countries : ['India'],
                primary_endpoint: studyData.primary_endpoint || '',
                secondary_endpoints: studyData.secondary_endpoints?.length ? studyData.secondary_endpoints : [],
                inclusion_criteria: studyData.inclusion_criteria?.length ? studyData.inclusion_criteria : ['Adults'],
                exclusion_criteria: studyData.exclusion_criteria?.length ? studyData.exclusion_criteria : ['None specified'],
                age_range: studyData.age_range || '18-65 years',
                sponsor_name: studyData.sponsor_name || '',
                ...(studyData.comparator_name ? { comparator_name: studyData.comparator_name } : {}),
            };

            const response = await axios.post(`${API_URL}/api/generate/document`, {
                document_type: documentType,
                study_data: completeStudyData,
                generate_all_sections: true
            }, {
                headers: { 'X-Session-ID': getSessionId() }
            });

            const result = response.data;

            if (result.status === 'success') {
                setGeneratedSections(result.sections);
            } else {
                setError(result.message || 'Generation failed');
            }
        } catch (err: any) {
            // Show detailed validation errors from the 422 handler
            if (err?.response?.status === 422 && err?.response?.data?.detail) {
                const details = err.response.data.detail;
                const fieldErrors = Array.isArray(details)
                    ? details.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ')
                    : String(details);
                setError(`Validation error: ${fieldErrors}`);
            } else {
                setError(err instanceof Error ? err.message : err?.response?.data?.detail || 'Unknown error');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Document Generator
                        </h1>
                        <p className="text-gray-600">
                            Generate regulatory documents section-by-section with inline validation
                        </p>
                    </div>

                    {/* Document Type Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Document Type
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {['protocol', 'icf', 'csr', 'ctri', 'ib'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setDocumentType(type)}
                                    className={`px-4 py-3 rounded-lg font-medium transition-all ${documentType === type
                                        ? 'bg-indigo-600 text-white shadow-lg scale-105'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {type.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Multi-Step Form */}
                    <div className="mb-8">
                        {/* Step Indicator */}
                        <div className="flex items-center justify-between mb-6">
                            {[1, 2, 3].map(step => (
                                <div key={step} className="flex items-center flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${currentStep >= step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                        {step}
                                    </div>
                                    {step < 3 && (
                                        <div className={`flex-1 h-1 mx-2 ${currentStep > step ? 'bg-indigo-600' : 'bg-gray-200'
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Step 1: Basic Information */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-gray-800 mb-4">Basic Study Information</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Study Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.study_title || ''}
                                            onChange={(e) => handleInputChange('study_title', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="Phase III Study of..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Protocol Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.protocol_number || ''}
                                            onChange={(e) => handleInputChange('protocol_number', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="XYZ-123-P3-001 v2.0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phase *
                                        </label>
                                        <select
                                            value={studyData.phase || ''}
                                            onChange={(e) => handleInputChange('phase', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        >
                                            <option value="">Select Phase</option>
                                            <option value="I">Phase I</option>
                                            <option value="II">Phase II</option>
                                            <option value="III">Phase III</option>
                                            <option value="IV">Phase IV</option>
                                            <option value="BE">Bioequivalence</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Indication *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.indication || ''}
                                            onChange={(e) => handleInputChange('indication', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="Type 2 Diabetes Mellitus"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Sponsor Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.sponsor_name || ''}
                                            onChange={(e) => handleInputChange('sponsor_name', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="XYZ Pharmaceuticals Ltd."
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    Next: Study Design
                                </button>
                            </div>
                        )}

                        {/* Step 2: Study Design */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-gray-800 mb-4">Study Design</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            IMP Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.imp_name || ''}
                                            onChange={(e) => handleInputChange('imp_name', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            IMP Dose & Route
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={studyData.imp_dose || ''}
                                                onChange={(e) => handleInputChange('imp_dose', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                placeholder="50 mg"
                                            />
                                            <input
                                                type="text"
                                                value={studyData.imp_route || ''}
                                                onChange={(e) => handleInputChange('imp_route', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                placeholder="oral"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Design Type *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.design_type || ''}
                                            onChange={(e) => handleInputChange('design_type', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="Parallel group"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Blinding *
                                        </label>
                                        <select
                                            value={studyData.blinding || ''}
                                            onChange={(e) => handleInputChange('blinding', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        >
                                            <option value="">Select Blinding</option>
                                            <option value="Open-label">Open-label</option>
                                            <option value="Single-blind">Single-blind</option>
                                            <option value="Double-blind">Double-blind</option>
                                            <option value="Triple-blind">Triple-blind</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Sample Size *
                                        </label>
                                        <input
                                            type="number"
                                            value={studyData.sample_size || ''}
                                            onChange={(e) => handleInputChange('sample_size', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Duration *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.duration || ''}
                                            onChange={(e) => handleInputChange('duration', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="24 weeks"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Randomization *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.randomization || ''}
                                            onChange={(e) => handleInputChange('randomization', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="1:1 ratio, stratified by age"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Number of Sites *
                                        </label>
                                        <input
                                            type="number"
                                            value={studyData.site_count || ''}
                                            onChange={(e) => handleInputChange('site_count', parseInt(e.target.value) || 1)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="10"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => setCurrentStep(1)}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                    >
                                        Next: Endpoints & Criteria
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Endpoints & Criteria */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-gray-800 mb-4">Endpoints & Eligibility</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Age Range *
                                        </label>
                                        <input
                                            type="text"
                                            value={studyData.age_range || ''}
                                            onChange={(e) => handleInputChange('age_range', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="18-65 years"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Primary Endpoint *
                                    </label>
                                    <input
                                        type="text"
                                        value={studyData.primary_endpoint || ''}
                                        onChange={(e) => handleInputChange('primary_endpoint', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="Change from baseline in HbA1c at Week 12"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Secondary Endpoints (one per line)
                                    </label>
                                    <textarea
                                        value={studyData.secondary_endpoints?.join('\n') || ''}
                                        onChange={(e) => handleArrayInput('secondary_endpoints', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        rows={3}
                                        placeholder="Change in fasting plasma glucose&#10;Proportion achieving HbA1c <7%"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Inclusion Criteria (one per line) *
                                    </label>
                                    <textarea
                                        value={studyData.inclusion_criteria?.join('\n') || ''}
                                        onChange={(e) => handleArrayInput('inclusion_criteria', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        rows={4}
                                        placeholder="Adults 18-65 years&#10;T2DM per ADA criteria&#10;HbA1c 7.0-10.0%"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Exclusion Criteria (one per line) *
                                    </label>
                                    <textarea
                                        value={studyData.exclusion_criteria?.join('\n') || ''}
                                        onChange={(e) => handleArrayInput('exclusion_criteria', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        rows={4}
                                        placeholder="Type 1 DM&#10;Severe hepatic impairment&#10;Pregnant/breastfeeding"
                                    />
                                </div>

                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={generateDocument}
                                        disabled={isGenerating}
                                        className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Generating...
                                            </>
                                        ) : (
                                            'Generate Document'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 font-medium">Error: {error}</p>
                        </div>
                    )}

                    {/* Generated Sections */}
                    {generatedSections.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Generated Sections</h2>
                            <div className="space-y-4">
                                {generatedSections.map((section, index) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {section.section_number}. {section.section_title}
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${section.review_priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                                                    section.review_priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                    {section.review_priority}
                                                </span>
                                                <span className="text-sm font-medium text-gray-600">
                                                    {section.completion_percentage}% Complete
                                                </span>
                                            </div>
                                        </div>
                                        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                                            {section.generated_content}
                                        </div>
                                        {section.placeholders.length > 0 && (
                                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                                <p className="text-sm font-medium text-yellow-800 mb-2">
                                                    Placeholders ({section.placeholders.length}):
                                                </p>
                                                <ul className="text-sm text-yellow-700 list-disc list-inside">
                                                    {section.placeholders.slice(0, 3).map((ph, i) => (
                                                        <li key={i}>{ph}</li>
                                                    ))}
                                                    {section.placeholders.length > 3 && (
                                                        <li>... and {section.placeholders.length - 3} more</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
