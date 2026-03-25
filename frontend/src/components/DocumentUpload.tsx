'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface DocumentUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
}

export default function DocumentUpload({ onFileSelect, selectedFile }: DocumentUploadProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        },
        maxFiles: 1,
        maxSize: 50 * 1024 * 1024, // 50MB
    });

    const [loadingSample, setLoadingSample] = React.useState(false);

    const handleTrySample = async () => {
        setLoadingSample(true);
        try {
            const response = await fetch('/sample/sample-protocol.pdf');
            if (!response.ok) throw new Error('Sample file not found');
            const blob = await response.blob();
            const file = new File([blob], 'sample-clinical-protocol.pdf', { type: 'application/pdf' });
            onFileSelect(file);
        } catch {
            alert('Sample document is not available yet. Please upload your own document.');
        } finally {
            setLoadingSample(false);
        }
    };

    return (
        <div className="w-full">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                    }`}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center gap-4">
                    <svg
                        className="w-16 h-16 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>

                    {selectedFile ? (
                        <div className="text-center">
                            <p className="text-lg font-semibold text-gray-700">{selectedFile.name}</p>
                            <p className="text-sm text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-sm text-primary mt-2">Click or drag to replace</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-lg font-semibold text-gray-700">
                                {isDragActive ? 'Drop the file here' : 'Upload Document'}
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                Drag and drop or click to select
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Supported formats: PDF, DOCX (Max 50MB)
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sample Document Button */}
            {!selectedFile && (
                <div className="text-center mt-4">
                    <p className="text-sm text-gray-400 mb-2">or</p>
                    <button
                        onClick={handleTrySample}
                        disabled={loadingSample}
                        className="px-5 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingSample ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading Sample...
                            </span>
                        ) : (
                            'Try with Sample Clinical Protocol →'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
