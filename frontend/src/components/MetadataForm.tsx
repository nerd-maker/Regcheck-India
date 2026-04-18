'use client';

import React from 'react';

export interface DocumentMetadata {
    document_type: string;
    sponsor_name: string;
    drug_name: string;
    inn?: string;
    trial_phase: string;
    submission_target: string;
    version?: string;
    date?: string;
}

interface MetadataFormProps {
    metadata: DocumentMetadata;
    onChange: (metadata: DocumentMetadata) => void;
}

export default function MetadataForm({ metadata, onChange }: MetadataFormProps) {
    const handleChange = (field: keyof DocumentMetadata, value: string) => {
        onChange({ ...metadata, [field]: value });
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Document Metadata</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Document Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={metadata.document_type}
                        onChange={(e) => handleChange('document_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    >
                        <option value="">Select Type</option>
                        <option value="Clinical Study Protocol">Clinical Study Protocol</option>
                        <option value="Informed Consent Form">Informed Consent Form</option>
                        <option value="Clinical Study Report">Clinical Study Report</option>
                        <option value="Investigator's Brochure">Investigator&apos;s Brochure</option>
                        <option value="CTRI Registration Form">CTRI Registration Form</option>
                        <option value="CT-04 Form">CT-04 Form</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {/* Sponsor Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sponsor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={metadata.sponsor_name}
                        onChange={(e) => handleChange('sponsor_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter sponsor name"
                        required
                    />
                </div>

                {/* Drug Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Drug Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={metadata.drug_name}
                        onChange={(e) => handleChange('drug_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter drug name"
                        required
                    />
                </div>

                {/* INN */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        INN (International Nonproprietary Name)
                    </label>
                    <input
                        type="text"
                        value={metadata.inn || ''}
                        onChange={(e) => handleChange('inn', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter INN"
                    />
                </div>

                {/* Trial Phase */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trial Phase <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={metadata.trial_phase}
                        onChange={(e) => handleChange('trial_phase', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    >
                        <option value="">Select Phase</option>
                        <option value="Phase I">Phase I</option>
                        <option value="Phase II">Phase II</option>
                        <option value="Phase III">Phase III</option>
                        <option value="Phase IV">Phase IV</option>
                        <option value="BA/BE Study">BA/BE Study</option>
                        <option value="Not Applicable">Not Applicable</option>
                    </select>
                </div>

                {/* Submission Target */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Submission Target <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={metadata.submission_target}
                        onChange={(e) => handleChange('submission_target', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    >
                        <option value="">Select Target</option>
                        <option value="CDSCO CT-04">CDSCO CT-04</option>
                        <option value="CTRI Registration">CTRI Registration</option>
                        <option value="Ethics Committee">Ethics Committee</option>
                        <option value="WHO-PQ">WHO-PQ</option>
                        <option value="FDA ANDA">FDA ANDA</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {/* Version */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Version
                    </label>
                    <input
                        type="text"
                        value={metadata.version || ''}
                        onChange={(e) => handleChange('version', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="e.g., 1.0"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                    </label>
                    <input
                        type="date"
                        value={metadata.date || ''}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>
        </div>
    );
}
