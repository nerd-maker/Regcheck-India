'use client';

import React, { useId, useRef, useState } from 'react';

import { extractTextFromFile } from '@/services/api';

interface FileUploadProps {
  onTextExtracted: (text: string, filename: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export default function FileUpload({ onTextExtracted, onError, disabled }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      onError('Please upload a PDF or DOCX file only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onError('File size must be under 10MB.');
      return;
    }

    setUploading(true);
    setUploadedFile(null);

    try {
      const result = await extractTextFromFile(file);
      setUploadedFile(file.name);
      onTextExtracted(result.extracted_text, file.name);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to process file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer transition-all duration-200 w-fit ${
          disabled || uploading
            ? 'border-white/10 text-slate-500 cursor-not-allowed'
            : 'border-white/20 text-slate-300 hover:border-teal-400/50 hover:text-teal-400'
        }`}
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Extracting text...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload PDF or DOCX
          </>
        )}
      </label>
      {uploadedFile && (
        <div className="mt-2 flex items-center gap-2 text-xs text-teal-400">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {uploadedFile} - text extracted successfully
        </div>
      )}
    </div>
  );
}
