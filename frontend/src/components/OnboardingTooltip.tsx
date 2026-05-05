'use client';

import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'regcheck_onboarding_done';

const STEPS = [
  {
    title: "Welcome to RegCheck-India ",
    description: "India's first AI compliance platform for pharmaceutical regulatory submissions.",
    highlight: null
  },
  {
    title: "Step 1 — Enter your API key",
    description: "Click the key icon at the bottom of the sidebar to enter your Anthropic API key. Don't have one? Get it free at console.anthropic.com",
    highlight: "api-key-section"
  },
  {
    title: "Step 2 — Start with M1 PII Anonymiser",
    description: "Always anonymise your documents first before running any other analysis. This protects patient and investigator privacy.",
    highlight: "m1-module"
  },
  {
    title: "Step 3 — Run compliance checks",
    description: "Use M3 for completeness checks, M7 for Schedule Y compliance, M8 for ICH GCP. Use 'Load sample data' to see how each module works.",
    highlight: "compliance-section"
  },
  {
    title: "Step 4 — Pipe outputs between modules",
    description: "After anonymising in M1, click 'Send to Module' to pipe the anonymised text directly to M3 or M7 — no copy-pasting needed.",
    highlight: null
  },
  {
    title: "You're ready! ",
    description: "All outputs include an AI disclaimer — always have a qualified RA professional review before regulatory submission.",
    highlight: null
  }
];

export default function OnboardingTooltip() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={dismiss}
      />

      {/* Tooltip card */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md z-[70] px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-gray-900 border border-teal-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden relative">
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4 relative z-10">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 bg-teal-400'
                    : i < step
                    ? 'w-1.5 bg-teal-400/50'
                    : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
            <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Content */}
          <div className="relative z-10">
            <h3 className="font-bold text-white text-lg mb-2">
              {current.title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              {current.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between relative z-10">
            <button
              onClick={dismiss}
              className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="px-4 py-2 bg-white/5 text-slate-300 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="px-6 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-900/20 hover:bg-teal-500 hover:-translate-y-0.5 transition-all active:translate-y-0"
              >
                {step === STEPS.length - 1 ? "Get Started" : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
