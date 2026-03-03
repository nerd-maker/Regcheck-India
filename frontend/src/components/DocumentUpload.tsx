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
        </div>
    );
}
