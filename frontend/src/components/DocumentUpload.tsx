'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface DocumentUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export default function DocumentUpload({ onFileSelect, selectedFile }: DocumentUploadProps) {
  const [loadingSample, setLoadingSample] = React.useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

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
    <div className="space-y-5">
      <div
        {...getRootProps()}
        className={`rounded-[28px] border border-dashed p-8 text-center transition-all ${
          isDragActive
            ? 'border-teal-300/70 bg-teal-300/10 shadow-[0_18px_40px_rgba(91,192,190,0.18)]'
            : 'border-white/15 bg-[rgba(255,255,255,0.03)] hover:border-white/30 hover:bg-[rgba(255,255,255,0.05)]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-2xl font-semibold text-slate-100">
            UP
          </div>

          {selectedFile ? (
            <div className="space-y-2">
              <p className="text-xl font-semibold text-white">{selectedFile.name}</p>
              <p className="text-sm text-slate-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB staged for review
              </p>
              <p className="text-sm text-teal-200">Click or drop a new file to replace it.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xl font-semibold text-white">
                {isDragActive ? 'Drop the source file here' : 'Upload a regulatory source document'}
              </p>
              <p className="mx-auto max-w-lg text-sm leading-6 text-slate-400">
                Bring in a PDF or DOCX file and move directly into compliance mapping, summary, or
                filing review.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="status-chip">PDF</span>
                <span className="status-chip">DOCX</span>
                <span className="status-chip">Max 50 MB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedFile && (
        <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
          <p className="text-sm text-slate-400">
            Use a sample protocol if you want a fast product walkthrough before uploading your own file.
          </p>
          <button type="button" onClick={handleTrySample} disabled={loadingSample} className="secondary-button">
            {loadingSample ? 'Loading sample...' : 'Load sample protocol'}
          </button>
        </div>
      )}
    </div>
  );
}
