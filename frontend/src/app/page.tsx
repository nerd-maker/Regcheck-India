'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// Counter animation hook
function useCountUp(target: number, duration: number = 2000, trigger: boolean = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let startTime: number
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [trigger, target, duration])
  return count
}

export default function LandingPage() {
  const [announcementVisible, setAnnouncementVisible] = useState(true)
  const [navScrolled, setNavScrolled] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const [earlyAccessData, setEarlyAccessData] = useState({ name: '', email: '', org: '', role: '' })

  // Nav shadow on scroll
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible')
          }
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Stats counter trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const handleEarlyAccess = () => {
    window.location.href = `mailto:regcheck.india@gmail.com?subject=Early Access Request — ${earlyAccessData.org}&body=Name: ${earlyAccessData.name}%0AOrg: ${earlyAccessData.org}%0ARole: ${earlyAccessData.role}`
  }

  return (
    <div className="bg-surface text-on-surface font-body">

      {/* ── SECTION 1: Announcement Bar ── */}
      {announcementVisible && (
        <div className="bg-primary text-secondary-fixed-dim py-3 px-4 text-center text-xs font-medium tracking-wider uppercase relative">
          🏆 CDSCO AI Health Innovation Hackathon Participant 2024 • Now integrating AIKosh Sovereign AI Stack
          <button
            onClick={() => setAnnouncementVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── SECTION 2: Navigation ── */}
      <header className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md transition-shadow ${navScrolled ? 'shadow-ambient' : ''}`}>
        <nav className="max-w-7xl mx-auto flex justify-between items-center px-6 h-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg">
              <span className="text-white font-black text-lg">R</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">RegCheck<span className="text-secondary">-India</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-on-surface-variant">
            <a href="#platform" className="hover:text-secondary transition-colors">Platform</a>
            <a href="#solutions" className="hover:text-secondary transition-colors">Solutions</a>
            <a href="#ai-stack" className="hover:text-secondary transition-colors">Technology</a>
            <a href="#early-access" className="hover:text-secondary transition-colors">Early Access</a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/nerd-maker/Regcheck-India"
              target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant"
            >
              {/* GitHub icon */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.72-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <a
              href="mailto:regcheck.india@gmail.com?subject=RegCheck-India Demo Request"
              className="hidden sm:flex items-center gap-1 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors"
            >
              Request Demo
            </a>
            <Link
              href="/app"
              className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-ambient hover:shadow-ambient-lg transition-all active:scale-95 flex items-center gap-2"
            >
              Launch App
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </nav>
      </header>

      {/* ── SECTION 3: Hero ── */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div className="z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
              India&apos;s First CDSCO-Native AI Compliance Platform
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-primary leading-[1.1] tracking-tight mb-6">
              Automate <span className="text-secondary">Pharmaceutical</span> Regulatory Compliance.
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed mb-10 max-w-xl">
              Harness India&apos;s sovereign AI to navigate CDSCO, NDCTR 2019, and Schedule Y regulations with precision. Built exclusively for the Indian pharmaceutical regulatory ecosystem.
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <Link href="/app" className="btn-primary-gradient text-white px-8 py-4 rounded-xl font-bold shadow-xl flex items-center gap-3">
                Try Free Demo
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a href="#early-access" className="bg-surface-container-high text-primary px-8 py-4 rounded-xl font-bold flex items-center gap-3 hover:bg-surface-container transition-colors">
                Request Pilot Access
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            </div>
            {/* Stats row */}
            <div ref={statsRef} className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-3xl font-extrabold text-primary">170+</div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tests Passing</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-primary">4</div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Core Modules</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-primary">9+</div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Regulatory Frameworks</div>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-6">
              ✓ Free pilot access  ✓ CDSCO-trained AI  ✓ All outputs require qualified RA review
            </p>
          </div>

          {/* Right column — floating compliance card */}
          <div className="relative">
            <div className="absolute -inset-10 bg-secondary/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="relative glass-panel-landing rounded-2xl shadow-2xl p-6 border border-white/40 animate-float">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">Protocol_V4_Final.pdf</div>
                    <div className="text-[10px] text-on-surface-variant">Regulatory Audit in Progress...</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-surface-container-lowest rounded-xl border-l-4 border-on-tertiary-container">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-on-tertiary-container">Schedule Y — Sec 4.2</span>
                    <span className="text-[10px] font-bold text-on-tertiary-container">COMPLIANT ✓</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-on-tertiary-container w-[98%] rounded-full"></div>
                  </div>
                </div>
                <div className="p-4 bg-surface-container-lowest rounded-xl border-l-4 border-amber-500">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-amber-700">ICH E6(R3) — Sec 7.1</span>
                    <span className="text-[10px] font-bold text-amber-700">PARTIAL ⚠</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[65%] rounded-full"></div>
                  </div>
                </div>
                <div className="p-4 bg-surface-container-lowest rounded-xl border-l-4 border-error">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-error">NDCTR 2019 — Sec 9.3</span>
                    <span className="text-[10px] font-bold text-error">NON-COMPLIANT ✗</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-error w-[20%] rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-surface-container flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Gap Analysis: 3 items require attention</span>
                <button className="text-xs font-bold text-secondary flex items-center gap-1 hover:underline">
                  Generate Report
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Frameworks Marquee ── */}
      <section className="py-12 bg-surface-container-low border-y border-outline-variant/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-8">
            Aligned with Official Indian &amp; International Regulatory Frameworks
          </div>
          <div className="marquee-container">
            {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'CDSCO GCP', 'CTRI Requirements', 'DPDP Act 2023', 'NDHM Guidelines', 'ICMR Ethics', 'Drugs & Cosmetics Act', 'Pharmacovigilance Rules', 'Medical Devices Rules 2017',
              'NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'CDSCO GCP', 'CTRI Requirements', 'DPDP Act 2023', 'NDHM Guidelines', 'ICMR Ethics', 'Drugs & Cosmetics Act', 'Pharmacovigilance Rules', 'Medical Devices Rules 2017',
            ].map((framework, i) => (
              <span key={i} className="mx-6 px-6 py-3 bg-white rounded-full text-xs font-bold shadow-sm text-primary whitespace-nowrap flex-shrink-0">
                {framework}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: Problem ── */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="animate-on-scroll">
            <div className="text-xs font-bold text-error uppercase tracking-widest mb-4">The Challenge</div>
            <h2 className="text-4xl font-extrabold text-primary leading-tight mb-8">
              Indian Pharma Regulatory Compliance Is Broken
            </h2>
            <p className="text-on-surface-variant leading-relaxed text-lg mb-6">
              India&apos;s pharmaceutical industry operates under one of the most complex regulatory environments globally. The CDSCO enforces NDCTR 2019, Schedule Y, and increasingly stringent ICH harmonisation requirements — all simultaneously.
            </p>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              A single clinical trial application requires upward of 40 regulatory documents, each checked against overlapping checklists. A missed mandatory field in an Informed Consent Form triggers a deficiency letter — delaying the trial by months and costing lakhs in senior RA professional time.
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              Global tools like Veeva Vault and MasterControl are not trained on CDSCO-specific frameworks. RegCheck-India closes this gap — the only AI compliance platform built exclusively on India&apos;s pharmaceutical regulatory corpus.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 animate-on-scroll">
            <div className="p-8 bg-white shadow-ambient rounded-2xl">
              <div className="text-4xl font-black text-primary mb-2">45%</div>
              <div className="text-sm font-semibold text-on-surface-variant">Application Rejection Rate</div>
            </div>
            <div className="p-8 bg-surface-container text-primary rounded-2xl">
              <div className="text-4xl font-black mb-2">12mo</div>
              <div className="text-sm font-semibold">Avg Approval Cycle</div>
            </div>
            <div className="p-8 bg-primary text-white rounded-2xl">
              <div className="text-4xl font-black mb-2">3,000+</div>
              <div className="text-sm font-semibold opacity-80">Pharma Companies in India</div>
            </div>
            <div className="p-8 bg-secondary text-white rounded-2xl">
              <div className="text-4xl font-black mb-2">₹0</div>
              <div className="text-sm font-semibold opacity-80">CDSCO-specific AI tools (before RegCheck)</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: Platform Modules ── */}
      <section id="platform" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 animate-on-scroll">
            <div className="text-xs font-bold text-secondary uppercase tracking-widest mb-4">Platform</div>
            <h2 className="text-4xl font-extrabold text-primary mb-4">A Sovereign Intelligence Platform</h2>
            <p className="text-on-surface-variant text-lg">Four integrated modules covering the full Indian pharmaceutical regulatory lifecycle.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '📄', tag: 'M1', title: 'Compliance Evaluator', color: 'hover:border-secondary/20', desc: 'Per-section COMPLIANT/NON_COMPLIANT status against NDCTR 2019, Schedule Y, and ICH guidelines with specific clause citations and remediation guidance.', href: '/app' },
              { icon: '⚙️', tag: 'M2', title: 'Document Generator', color: 'hover:border-on-tertiary-container/20', desc: 'Generate clinical trial protocols (16 sections), ICFs (12 sections), CSRs, CTRI registrations, and IBs with inline compliance validation.', href: '/app' },
              { icon: '💬', tag: 'M3', title: 'Query Response Assistant', color: 'hover:border-amber-400/30', desc: 'Classify CDSCO deficiency letters into 16 categories and draft structured responses with commitment tracking and deadline escalation.', href: '/app' },
              { icon: '📊', tag: 'M4', title: 'Regulatory Intelligence', color: 'hover:border-error/20', desc: 'Monitor CDSCO/MOHFW publications in real time. Instant impact assessment on active submissions with weekly digest exports.', href: '/app' },
            ].map((mod) => (
              <Link key={mod.tag} href={mod.href} className={`group bg-white p-8 rounded-2xl hover:shadow-ambient-lg transition-all border border-transparent ${mod.color}`}>
                <div className="text-4xl mb-4">{mod.icon}</div>
                <div className="text-[10px] font-black text-secondary uppercase tracking-widest mb-2">{mod.tag}</div>
                <h3 className="text-lg font-bold text-primary mb-3">{mod.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{mod.desc}</p>
                <span className="text-xs font-bold text-secondary group-hover:underline">Try it →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: AI Stack ── */}
      <section id="ai-stack" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="text-xs font-bold text-secondary uppercase tracking-widest mb-4">Technology</div>
          <h2 className="text-3xl font-extrabold text-primary mb-4">Built on India&apos;s Sovereign AI Stack</h2>
          <p className="text-on-surface-variant max-w-2xl mx-auto">
            The only pharmaceutical compliance platform built exclusively on AIKosh — India&apos;s national AI model repository under the IndiaAI Mission — ensuring data sovereignty and Indian language support.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-on-scroll">
          {[
            { name: 'Sarvam-105B', role: 'Primary LLM', tag: 'AIKosh ✓', highlight: true },
            { name: 'BharatGen Param2', role: 'Health Domain', tag: 'IIT Bombay ✓', highlight: false },
            { name: 'IndicBERT', role: 'NER Engine', tag: 'AI4Bharat ✓', highlight: false },
            { name: 'IndicTrans2', role: 'Translation', tag: 'AI4Bharat ✓', highlight: false },
            { name: 'IndicWav2Vec', role: 'Speech ASR', tag: 'AI4Bharat ✓', highlight: false },
          ].map((model) => (
            <div key={model.name} className={`p-6 rounded-xl flex flex-col items-center text-center ${model.highlight ? 'bg-white border-2 border-secondary/30 shadow-ambient' : 'bg-surface-container'}`}>
              <div className={`text-sm font-black mb-1 ${model.highlight ? 'text-secondary' : 'text-primary'}`}>{model.name}</div>
              <div className="text-[10px] uppercase font-bold text-on-surface-variant mb-2">{model.role}</div>
              <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${model.highlight ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>{model.tag}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-on-surface-variant mt-8">
          All models available via AIKosh (aikosh.indiaai.gov.in) — India&apos;s national AI model repository under MeitY&apos;s IndiaAI Mission
        </p>
      </section>

      {/* ── SECTION 8: Stakeholders ── */}
      <section id="solutions" className="py-24 bg-primary text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h2 className="text-4xl font-extrabold mb-16">Solutions for the Indian Pharma Ecosystem</h2>
          <div className="grid lg:grid-cols-3 gap-12">
            {[
              { icon: '🏢', title: 'Pharmaceutical Companies', desc: 'Automate pre-submission compliance checks before CDSCO filing. Reduce review cycles and accelerate time-to-approval across concurrent trials.' },
              { icon: '🔬', title: 'Contract Research Organisations', desc: 'Speed up protocol reviews, SAE classification, and query responses. Handle higher documentation volumes with consistent quality.' },
              { icon: '⚖️', title: 'RA Consultants & Firms', desc: 'Handle more client engagements with AI-assisted compliance reviews. Deliver faster turnaround with comprehensive audit trails.' },
            ].map((item) => (
              <div key={item.title} className="space-y-6">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">{item.icon}</div>
                <h3 className="text-2xl font-bold">{item.title}</h3>
                <p className="opacity-70 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none text-[400px] font-black text-white select-none">R</div>
      </section>

      {/* ── SECTION 9: Process Timeline ── */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-extrabold text-primary text-center mb-20 animate-on-scroll">
          From Document Upload to Compliance Report in Minutes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-surface-container hidden md:block -translate-y-1/2 pointer-events-none"></div>
          {[
            { n: 1, title: 'Upload', desc: 'Upload PDF or DOCX clinical trial protocol, ICF, or regulatory document.' },
            { n: 2, title: 'Evaluate', desc: 'AI cross-references against NDCTR 2019, Schedule Y, and ICH guidelines via RAG pipeline.' },
            { n: 3, title: 'Report', desc: 'Receive per-section compliance status with specific gap analysis and regulatory citations.' },
            { n: 4, title: 'Review', desc: 'Export compliance report for review by qualified RA professionals before CDSCO submission.' },
          ].map((step) => (
            <div key={step.n} className="relative bg-white p-8 rounded-2xl shadow-sm border border-surface-container text-center animate-on-scroll">
              <div className="w-12 h-12 bg-secondary text-white rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 font-bold text-lg">
                {step.n}
              </div>
              <h4 className="font-bold text-primary mb-2">{step.title}</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 10: Trust ── */}
      <section className="py-24 bg-surface-container-high">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 animate-on-scroll">
            <h2 className="text-3xl font-extrabold text-primary mb-6">Built for Regulatory Trust</h2>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              RegCheck-India is a quality assurance tool — not a replacement for qualified regulatory professionals. All platform outputs are designed to assist, not replace, the judgment of licensed RA professionals and qualified CDSCO reviewers.
            </p>
            <div className="space-y-3">
              {['All outputs clearly marked as AI-generated', 'Every finding cited to specific regulatory source', 'Designed for professional review before use', 'Never to be submitted to CDSCO without RA sign-off', 'PII/PHI detection on all processed documents', 'DPDP Act 2023 compliant data handling'].map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-on-surface">{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 grid grid-cols-2 gap-6 animate-on-scroll">
            {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'DPDP Act 2023', 'NDHM Guidelines', 'ICMR Ethics'].map((framework) => (
              <div key={framework} className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-ambient">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-primary">{framework}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 11: Early Access Form ── */}
      <section id="early-access" className="py-24 max-w-5xl mx-auto px-6">
        <div className="bg-primary-container p-12 lg:p-20 rounded-[40px] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-extrabold mb-6">Join the Early Access Program</h2>
            <p className="opacity-80 mb-10">
              Be among the first Indian pharmaceutical companies, CROs, and RA consultancies to automate your regulatory workflow with RegCheck-India.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text" placeholder="Full Name"
                  value={earlyAccessData.name}
                  onChange={(e) => setEarlyAccessData(p => ({...p, name: e.target.value}))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-white placeholder-white/40 focus:outline-none focus:border-secondary transition-all"
                />
                <input
                  type="email" placeholder="Work Email"
                  value={earlyAccessData.email}
                  onChange={(e) => setEarlyAccessData(p => ({...p, email: e.target.value}))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-white placeholder-white/40 focus:outline-none focus:border-secondary transition-all"
                />
              </div>
              <input
                type="text" placeholder="Organisation Name"
                value={earlyAccessData.org}
                onChange={(e) => setEarlyAccessData(p => ({...p, org: e.target.value}))}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-white placeholder-white/40 focus:outline-none focus:border-secondary transition-all"
              />
              <select
                value={earlyAccessData.role}
                onChange={(e) => setEarlyAccessData(p => ({...p, role: e.target.value}))}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-white focus:outline-none focus:border-secondary transition-all"
              >
                <option value="" className="text-on-surface">Select Your Role</option>
                <option value="RA Professional" className="text-on-surface">RA Professional</option>
                <option value="CRO" className="text-on-surface">CRO</option>
                <option value="Pharma Company" className="text-on-surface">Pharma Company</option>
                <option value="Consultant" className="text-on-surface">Regulatory Consultant</option>
                <option value="Other" className="text-on-surface">Other</option>
              </select>
              <button
                onClick={handleEarlyAccess}
                className="w-full bg-secondary hover:bg-secondary-container text-white font-bold py-4 rounded-xl transition-all shadow-xl hover:shadow-secondary/30 active:scale-[0.98]"
              >
                Apply for Pilot Access →
              </button>
              <p className="text-[10px] opacity-40">✓ Free during pilot  ✓ No commitment  ✓ Direct line to the founder</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 12: Footer ── */}
      <footer className="bg-surface pt-24 pb-12 border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-primary flex items-center justify-center rounded">
                  <span className="text-white font-black text-sm">R</span>
                </div>
                <span className="text-lg font-bold tracking-tight text-primary">RegCheck-India</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                Bridging pharmaceutical excellence and regulatory velocity through India&apos;s sovereign AI.
              </p>
              <div className="flex gap-3">
                <a href="https://github.com/nerd-maker/Regcheck-India" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-secondary hover:text-white transition-all text-on-surface-variant">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.72-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
                <a href="mailto:regcheck.india@gmail.com" className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-secondary hover:text-white transition-all text-on-surface-variant">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-primary mb-6">Platform</h5>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                {['Compliance Evaluator', 'Document Generator', 'Query Assistant', 'Regulatory Intelligence'].map(l => (
                  <li key={l}><Link href="/app" className="hover:text-secondary transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-primary mb-6">Regulatory</h5>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'CDSCO Guidelines', 'DPDP Act 2023'].map(l => (
                  <li key={l}><a href="#" className="hover:text-secondary transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-primary mb-6">Company</h5>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li><a href="https://github.com/nerd-maker/Regcheck-India" className="hover:text-secondary transition-colors">GitHub</a></li>
                <li><a href="mailto:regcheck.india@gmail.com" className="hover:text-secondary transition-colors">Contact</a></li>
                <li><Link href="/app" className="hover:text-secondary transition-colors">Launch App</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container px-4 py-2 rounded-full">
              Pilot Version v1.0.0 | CDSCO Hackathon 2024
            </div>
            <p className="text-xs text-on-surface-variant text-center">
              © 2025 RegCheck-India. Built in India for Indian Pharma. Part of the AIKosh ecosystem.
            </p>
            <p className="text-[10px] text-on-surface-variant/60 text-center max-w-md">
              ⚠ Pilot tool. All outputs must be reviewed by qualified RA professionals before regulatory use.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
