'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
    const [email, setEmail] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleEarlyAccess = (e: React.FormEvent) => {
        e.preventDefault();
        window.location.href = `mailto:regcheck.india@gmail.com?subject=RegCheck-India Early Access Request&body=Hi, I'd like to request early access to RegCheck-India. My email: ${email}`;
    };

    return (
        <div className="min-h-screen bg-[#0A1628] text-white overflow-hidden">
            {/* ─── Section 1: Navigation Bar ─── */}
            <nav className="fixed top-0 w-full z-50 bg-[#0A1628]/90 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-[#2563EB] to-[#7C3AED] rounded-lg flex items-center justify-center text-sm font-bold">
                                R
                            </div>
                            <span className="text-xl font-bold tracking-tight">
                                RegCheck<span className="text-[#2563EB]">-India</span>
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-4">
                            <a
                                href="https://github.com/nerd-maker/Regcheck-India"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                GitHub
                            </a>
                            <a
                                href="mailto:regcheck.india@gmail.com?subject=RegCheck-India Demo Request"
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Request Demo
                            </a>
                            <Link
                                href="/app"
                                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-blue-500/25"
                            >
                                Launch App →
                            </Link>
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden pb-4 border-t border-white/10 mt-2 pt-4 space-y-3">
                            <a href="https://github.com/nerd-maker/Regcheck-India" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-400 hover:text-white">GitHub</a>
                            <a href="mailto:regcheck.india@gmail.com?subject=RegCheck-India Demo Request" className="block text-sm text-gray-400 hover:text-white">Request Demo</a>
                            <Link href="/app" className="block px-4 py-2 bg-[#2563EB] text-white text-sm font-semibold rounded-lg text-center">Launch App →</Link>
                        </div>
                    )}
                </div>
            </nav>

            {/* ─── Section 2: Hero ─── */}
            <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4">
                {/* Background glow effects */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#2563EB]/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-[#7C3AED]/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-full mb-8 animate-fadeIn">
                        <span className="w-2 h-2 bg-[#2563EB] rounded-full animate-pulse" />
                        <span className="text-sm text-[#93C5FD] font-medium">Built for Indian Pharma Regulation</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-fadeInUp">
                        AI-Powered Regulatory Compliance{' '}
                        <br className="hidden sm:block" />
                        <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">
                            for Indian Pharmaceutical Submissions
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed animate-fadeInUp animation-delay-100">
                        Automate document compliance checking, generate CDSCO-ready protocols,
                        draft regulatory query responses, and monitor regulatory changes — all
                        trained on NDCTR 2019, Schedule Y, and ICH guidelines.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fadeInUp animation-delay-200">
                        <Link
                            href="/app"
                            className="px-8 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl transition-all hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 text-base"
                        >
                            Try Free Demo →
                        </Link>
                        <a
                            href="https://github.com/nerd-maker/Regcheck-India"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3.5 border border-white/20 hover:border-white/40 text-white font-semibold rounded-xl transition-all hover:bg-white/5 text-base"
                        >
                            Watch 3-min Overview
                        </a>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 animate-fadeInUp animation-delay-300">
                        {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'CDSCO Guidelines', 'CTRI'].map((badge) => (
                            <span
                                key={badge}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm text-gray-300 font-medium hover:bg-white/10 transition-colors"
                            >
                                {badge}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Section 3: 4 Module Cards ─── */}
            <section className="py-20 sm:py-28 px-4 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Four Powerful Modules</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            End-to-end regulatory compliance — from document evaluation to ongoing intelligence.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Card 1 */}
                        <div className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-[#2563EB]/30 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-xl flex items-center justify-center text-2xl mb-5">📄</div>
                            <h3 className="text-xl font-bold mb-3">Compliance Evaluator</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">
                                Evaluate PDF/DOCX documents against CDSCO requirements. Per-section COMPLIANT / NON-COMPLIANT
                                status with gap analysis and remediation suggestions.
                            </p>
                            <Link href="/app" className="text-[#2563EB] text-sm font-semibold hover:text-[#93C5FD] transition-colors group-hover:underline">
                                Try it →
                            </Link>
                        </div>

                        {/* Card 2 */}
                        <div className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-[#7C3AED]/30 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl flex items-center justify-center text-2xl mb-5">⚙️</div>
                            <h3 className="text-xl font-bold mb-3">Document Generator</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">
                                Generate clinical trial protocols, ICFs, CSRs, and IBs section by section.
                                Inline compliance validation as each section is generated.
                            </p>
                            <Link href="/app" className="text-[#7C3AED] text-sm font-semibold hover:text-[#C4B5FD] transition-colors group-hover:underline">
                                Try it →
                            </Link>
                        </div>

                        {/* Card 3 */}
                        <div className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-[#059669]/30 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 bg-[#059669]/10 border border-[#059669]/20 rounded-xl flex items-center justify-center text-2xl mb-5">💬</div>
                            <h3 className="text-xl font-bold mb-3">Query Response Assistant</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">
                                Classify and draft responses to CDSCO deficiency letters across 16 query categories
                                with commitment tracking and deadline management.
                            </p>
                            <Link href="/app" className="text-[#059669] text-sm font-semibold hover:text-[#6EE7B7] transition-colors group-hover:underline">
                                Try it →
                            </Link>
                        </div>

                        {/* Card 4 */}
                        <div className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-[#D97706]/30 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 bg-[#D97706]/10 border border-[#D97706]/20 rounded-xl flex items-center justify-center text-2xl mb-5">📊</div>
                            <h3 className="text-xl font-bold mb-3">Regulatory Intelligence</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">
                                Monitor CDSCO/MOHFW publications. Instant impact assessment on your active
                                submissions with weekly digest reports.
                            </p>
                            <Link href="/app" className="text-[#D97706] text-sm font-semibold hover:text-[#FCD34D] transition-colors group-hover:underline">
                                Try it →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Section 4: How It Works ─── */}
            <section className="py-20 sm:py-28 px-4 bg-[#0D1D35]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
                        <p className="text-gray-400 text-lg">Three simple steps to compliance confidence.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connector lines (desktop only) */}
                        <div className="hidden md:block absolute top-12 left-[calc(33.33%+1rem)] right-[calc(33.33%+1rem)] h-0.5 bg-gradient-to-r from-[#2563EB] to-[#7C3AED]" />

                        {/* Step 1 */}
                        <div className="text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-[#2563EB]/20 to-[#2563EB]/5 border border-[#2563EB]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                                <span className="text-3xl">📤</span>
                                <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#2563EB] rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Upload Document</h3>
                            <p className="text-gray-400 text-sm">Upload your clinical trial protocol, ICF, or regulatory document in PDF or DOCX format.</p>
                        </div>

                        {/* Step 2 */}
                        <div className="text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-[#7C3AED]/20 to-[#7C3AED]/5 border border-[#7C3AED]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                                <span className="text-3xl">🤖</span>
                                <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#7C3AED] rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2">AI Evaluates Against Indian Regulations</h3>
                            <p className="text-gray-400 text-sm">Our AI cross-references your document against NDCTR 2019, Schedule Y, ICH guidelines, and CDSCO requirements.</p>
                        </div>

                        {/* Step 3 */}
                        <div className="text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-[#059669]/20 to-[#059669]/5 border border-[#059669]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                                <span className="text-3xl">📋</span>
                                <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#059669] rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Get Actionable Report</h3>
                            <p className="text-gray-400 text-sm">Receive a detailed compliance report with per-section status, citations, and recommended remediation language.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Section 5: Who Is This For ─── */}
            <section className="py-20 sm:py-28 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Who Is This For</h2>
                        <p className="text-gray-400 text-lg">Designed for every stakeholder in the Indian pharmaceutical regulatory ecosystem.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] transition-all duration-300">
                            <div className="text-4xl mb-5">🏢</div>
                            <h3 className="text-lg font-bold mb-3">Pharma Companies</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Automate pre-submission compliance checks before CDSCO filing. Reduce review cycles and accelerate
                                time-to-approval.
                            </p>
                        </div>

                        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] transition-all duration-300">
                            <div className="text-4xl mb-5">🔬</div>
                            <h3 className="text-lg font-bold mb-3">CROs</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Speed up clinical trial documentation and query responses. Handle higher volumes with
                                consistent quality.
                            </p>
                        </div>

                        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] transition-all duration-300">
                            <div className="text-4xl mb-5">👤</div>
                            <h3 className="text-lg font-bold mb-3">RA Consultants</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Handle more clients with AI-assisted compliance reviews. Deliver faster turnaround
                                with comprehensive audit trails.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Section 6: Early Access CTA ─── */}
            <section className="py-20 sm:py-28 px-4 bg-gradient-to-b from-[#0D1D35] to-[#0A1628]">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                        Join 50+ Regulatory Professionals on the Waitlist
                    </h2>
                    <p className="text-gray-400 mb-10 text-lg">
                        Get early access to RegCheck-India and start automating your compliance workflow.
                    </p>

                    <form onSubmit={handleEarlyAccess} className="flex flex-col sm:flex-row items-center gap-3 max-w-lg mx-auto">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            className="flex-1 w-full sm:w-auto px-5 py-3.5 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                        />
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 whitespace-nowrap"
                        >
                            Request Early Access →
                        </button>
                    </form>
                </div>
            </section>

            {/* ─── Section 7: Footer ─── */}
            <footer className="border-t border-white/10 py-12 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-gradient-to-br from-[#2563EB] to-[#7C3AED] rounded flex items-center justify-center text-xs font-bold">R</div>
                            <span className="font-bold">RegCheck-India</span>
                            <span className="text-sm text-gray-500">v1.0.0 | Pilot Version</span>
                        </div>

                        <p className="text-sm text-gray-500">
                            Built for Indian Pharmaceutical Regulatory Compliance
                        </p>

                        <p className="text-xs text-gray-600">
                            Evaluates against NDCTR 2019 | CDSCO Guidelines | ICH E6(R3) | Schedule Y | CTRI
                        </p>

                        <div className="flex items-center justify-center gap-6 pt-4">
                            <a href="https://github.com/nerd-maker/Regcheck-India" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors text-sm">GitHub</a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors text-sm">LinkedIn</a>
                            <a href="mailto:regcheck.india@gmail.com" className="text-gray-500 hover:text-white transition-colors text-sm">Contact</a>
                        </div>

                        <div className="pt-6 border-t border-white/5 mt-6">
                            <p className="text-xs text-gray-600 max-w-xl mx-auto">
                                ⚠ This is a pilot tool. All outputs must be reviewed by qualified regulatory professionals.
                                RegCheck-India does not provide legal or regulatory advice.
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
