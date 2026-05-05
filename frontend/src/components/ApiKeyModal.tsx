'use client';

import React, { useState, useEffect } from 'react';
import { getStoredKey, getSarvamKey, storeKey, storeSarvamKey } from '@/services/api';

interface ApiKeyModalProps {
  onKeySaved: (key: string) => void;
  isChanging?: boolean; // true when opened from settings (already has a key)
  onClose?: () => void;
}

export default function ApiKeyModal({ onKeySaved, isChanging = false, onClose }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [sarvamKey, setSarvamKey] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSarvamKey, setShowSarvamKey] = useState(false);

  useEffect(() => {
    // Load existing keys if they exist (will be auto-deobfuscated by getters)
    const savedKey = getStoredKey();
    const savedSarvamKey = getSarvamKey();
    setKey(savedKey);
    setSarvamKey(savedSarvamKey);
  }, []);

  const isValidKey = (key.startsWith('sk-ant-') && key.length > 20) || key === 'admin-regcheck';

  const handleSave = () => {
    if (!isValidKey) {
      setError('Please enter a valid Anthropic key (starts with sk-ant-) or admin override code');
      return;
    }
    storeKey(key);
    storeSarvamKey(sarvamKey);
    setError('');
    onKeySaved(key);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(121,225,214,0.15)' }}>
              <svg className="w-5 h-5" style={{ color: '#79e1d6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isChanging ? 'Settings' : 'Welcome to RegCheck-India'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure your AI API keys</p>
            </div>
          </div>

          {!isChanging && (
            <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(121,225,214,0.08)', border: '1px solid rgba(121,225,214,0.2)' }}>
              <p className="text-slate-300 leading-relaxed">
                RegCheck-India uses your personal API keys for all AI agent calls. Your credits are used directly — giving you unlimited, private access.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Anthropic Key */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Anthropic API Key (Required)
            </label>
            <div className="relative">
              <input
                id="anthropic-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="sk-ant-api03-..."
                autoFocus={!isChanging}
                className="w-full rounded-xl px-4 py-3 pr-12 text-sm font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: error ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Sarvam Key */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Sarvam AI API Key (For Audio)
            </label>
            <div className="relative">
              <input
                type={showSarvamKey ? 'text' : 'password'}
                value={sarvamKey}
                onChange={(e) => setSarvamKey(e.target.value)}
                placeholder="sarvam-..."
                className="w-full rounded-xl px-4 py-3 pr-12 text-sm font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowSarvamKey(!showSarvamKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showSarvamKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Get free credits at <a href="https://dashboard.sarvam.ai" target="_blank" className="text-teal-400 hover:underline">dashboard.sarvam.ai</a>
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center gap-3">
          <button
            id="api-key-save-btn"
            onClick={handleSave}
            disabled={!key}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isValidKey ? 'linear-gradient(135deg, #79e1d6, #3b82f6)' : 'rgba(121,225,214,0.3)',
              color: 'white',
            }}
          >
            {isChanging ? 'Update Keys' : 'Save & Continue'}
          </button>
          {isChanging && onClose && (
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
