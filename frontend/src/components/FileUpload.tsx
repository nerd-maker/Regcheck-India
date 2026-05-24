'use client';

import React, { useId, useRef, useState } from 'react';
import { extractTextFromFile } from '@/services/api';

interface FileUploadProps {
  onTextExtracted: (text: string, filename: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  label?: string;
  inputId?: string;
  uploadedFileName?: string | null;
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function FileUpload({
  onTextExtracted,
  onError,
  disabled,
  label = 'Upload a regulatory document',
  inputId: externalId,
  uploadedFileName,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [localUploadedFile, setLocalUploadedFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = externalId ?? generatedId;

  const uploadedFile = uploadedFileName !== undefined ? uploadedFileName : localUploadedFile;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setFileError(null);
    if (uploadedFileName === undefined) {
      setLocalUploadedFile(null);
    }

    // Type validation
    const isValidType = file.name.endsWith('.pdf') || file.name.endsWith('.docx');
    if (!isValidType) {
      const msg = 'Only PDF and DOCX files are accepted.';
      setFileError(msg);
      onError(msg);
      return;
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const msg = `File exceeds ${MAX_FILE_SIZE_MB} MB limit. Please compress or split the document.`;
      setFileError(msg);
      onError(msg);
      return;
    }

    setUploading(true);
    try {
      // Simulate extraction offline
      await new Promise((resolve) => setTimeout(resolve, 800));
      const dummyText = `Extracted content from ${file.name}. Simulated regulatory document text with clinical protocols and patient narratives.`;
      if (uploadedFileName === undefined) {
        setLocalUploadedFile(file.name);
      }
      onTextExtracted(dummyText, file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process file.';
      setFileError(msg);
      onError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // Simulate a change event
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const isDisabled = disabled || uploading;

  return (
    <div className="mb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileChange}
        disabled={isDisabled}
        className="sr-only"
        id={inputId}
        aria-label={label}
      />

      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center gap-3
          w-full rounded-xl border-2 border-dashed px-6 py-8
          text-center transition-all duration-200
          ${isDisabled
            ? 'cursor-not-allowed border-white/10 opacity-50'
            : uploadedFile
            ? 'cursor-pointer border-teal-500/50 bg-teal-500/5 hover:bg-teal-500/10'
            : 'cursor-pointer border-white/20 bg-white/[0.02] hover:border-teal-400/60 hover:bg-white/5'
          }
        `}
        style={{ minHeight: 140 }}
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm font-medium text-teal-400">Extracting text…</p>
            <p className="text-xs text-slate-500">This may take a moment for large documents</p>
          </>
        ) : uploadedFile ? (
          <>
            {/* Success check icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="28" height="28"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-teal-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-semibold text-teal-400">✓ {uploadedFile} selected — ready to run</p>
            <p className="text-xs text-slate-500">Click to replace</p>
          </>
        ) : (
          <>
            {/* Upload arrow icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="28" height="28"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-slate-400"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-medium text-slate-300">{label}</p>
            <p className="text-xs text-slate-500">PDF · DOCX · Max {MAX_FILE_SIZE_MB} MB · Click or drag &amp; drop</p>
          </>
        )}
      </label>

      {fileError && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {fileError}
        </p>
      )}
    </div>
  );
}
