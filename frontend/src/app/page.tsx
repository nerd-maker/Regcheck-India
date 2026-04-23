'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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
  const [navScrolled, setNavScrolled] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const documentsReviewed = useCountUp(218, 1400, statsVisible)
  const activeAgents = useCountUp(8, 900, statsVisible)
  const frameworksCovered = useCountUp(9, 1000, statsVisible)

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true)
      },
      { threshold: 0.3 }
    )

    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-white text-gray-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Serif+Display&display=swap');

        .fade-up {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .fade-up.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .fade-up:nth-child(2) { transition-delay: 0.1s; }
        .fade-up:nth-child(3) { transition-delay: 0.2s; }
        .fade-up:nth-child(4) { transition-delay: 0.3s; }
        .fade-up:nth-child(5) { transition-delay: 0.4s; }
        .fade-up:nth-child(6) { transition-delay: 0.5s; }
        .fade-up:nth-child(7) { transition-delay: 0.6s; }
        .fade-up:nth-child(8) { transition-delay: 0.7s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          animation: marquee 30s linear infinite;
          width: max-content;
        }

        .agent-card:hover .agent-icon {
          transform: scale(1.1);
          transition: transform 0.3s ease;
        }

        .hero-gradient {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 30%, #f8fafc 60%, #f0fdf4 100%);
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
        }

        iframe {
          color-scheme: light;
        }
      `}</style>

      <header
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          navScrolled
            ? 'border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-sm'
            : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 shadow-sm">
              <span className="text-base font-black text-white">R</span>
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-teal-700">RegCheck</span>
              <span className="text-gray-400">-India</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#platform" className="transition-colors hover:text-teal-600">Platform</a>
            <a href="#solutions" className="transition-colors hover:text-teal-600">Solutions</a>
            <a href="#trust" className="transition-colors hover:text-teal-600">Trust & Security</a>
            <a href="#contact" className="transition-colors hover:text-teal-600">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#contact"
              className="hidden px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-teal-600 sm:block"
            >
              Request Demo
            </a>
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Launch App
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </nav>
      </header>

      <section className="hero-gradient overflow-hidden pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500"></span>
                India&apos;s First CDSCO-Native AI Compliance Platform
              </div>

              <h1
                className="mb-6 text-5xl font-extrabold leading-[1.05] tracking-tight lg:text-6xl"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Pharmaceutical
                <span className="block text-teal-600">Regulatory Compliance,</span>
                <span className="block text-gray-400">Reimagined.</span>
              </h1>

              <p className="mb-10 max-w-lg text-lg leading-relaxed text-gray-500">
                Eight specialised AI agents built for India&apos;s pharma ecosystem, covering
                CDSCO, NDCTR 2019, Schedule Y, and ICH E6(R3) from document upload to compliance report.
              </p>

              <div className="mb-14 flex flex-wrap gap-4">
                <Link
                  href="/app"
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-teal-700"
                >
                  Try Free Demo
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="#contact"
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-8 py-4 text-sm font-semibold text-gray-700 transition-all hover:border-teal-300 hover:text-teal-600"
                >
                  Request Pilot Access
                </a>
              </div>

              <div ref={statsRef} className="grid grid-cols-3 gap-8 border-t border-gray-100 pt-8">
                <div>
                  <div className="text-3xl font-black text-teal-600">{documentsReviewed}+</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-400">Regulatory Checks Run</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-teal-600">{activeAgents}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-400">Active Agents</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-teal-600">{frameworksCovered}+</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-400">Regulatory Frameworks</div>
                </div>
              </div>
            </div>

            <div className="relative flex justify-center">
              <div className="absolute inset-0 rounded-full bg-teal-100/40 blur-3xl"></div>
              <div className="animate-float relative w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
                <div className="mb-6 flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50">
                    <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Protocol_V4_Final.pdf</div>
                    <div className="text-xs text-gray-400">Schedule Y Compliance Check</div>
                  </div>
                  <div className="ml-auto">
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-600">Live</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Schedule Y Section 4.2', status: 'COMPLIANT', pct: 98, color: 'bg-teal-500', textColor: 'text-teal-600', bgColor: 'bg-teal-50' },
                    { label: 'ICH E6(R3) Section 7.1', status: 'PARTIAL', pct: 65, color: 'bg-amber-400', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
                    { label: 'NDCTR 2019 Section 9.3', status: 'NON-COMPLIANT', pct: 20, color: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-50' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl p-3 ${item.bgColor}`}>
                      <div className="mb-2 flex justify-between">
                        <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                        <span className={`text-xs font-bold ${item.textColor}`}>{item.status}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-xs text-gray-400">3 items require attention</span>
                  <button className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline">
                    Generate Report
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-7xl px-6">
          <div className="flex items-center gap-4 overflow-hidden">
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-gray-400">Aligned with</span>
            <div className="flex-1 overflow-hidden">
              <div className="marquee-track">
                {[
                  'NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'CDSCO GCP',
                  'CTRI', 'DPDP Act 2023', 'NDHM', 'ICMR Ethics', 'D&C Act',
                  'NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'CDSCO GCP',
                  'CTRI', 'DPDP Act 2023', 'NDHM', 'ICMR Ethics', 'D&C Act',
                ].map((framework, i) => (
                  <span key={i} className="mx-3 whitespace-nowrap rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600">
                    {framework}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="platform" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="fade-up mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-600">Platform</div>
            <h2 className="mb-4 text-4xl font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              A Regulatory Intelligence Platform
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-500">
              Eight specialised AI agents covering the full pharmaceutical regulatory lifecycle in India.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 'M1', title: 'PII Anonymiser', desc: 'Detects and anonymises patient and investigator identities per DPDP Act 2023 and CDSCO Schedule Y.', tag: 'Privacy Lane' },
              { n: 'M2', title: 'Document Summariser', desc: 'Precis-style summarisation for protocols, SUGAM applications, SAE narratives, and meeting transcripts.', tag: 'Privacy Lane' },
              { n: 'M3', title: 'Completeness Checker', desc: 'Checks documents against CDSCO, NDCTR 2019, and ICH requirements, flagging CRITICAL, MAJOR and MINOR gaps.', tag: 'Compliance' },
              { n: 'M4', title: 'Case Classifier', desc: 'Classifies adverse events using ICH E2A seriousness criteria, WHO-UMC causality, and NDCTR 2019 timelines.', tag: 'Compliance' },
              { n: 'M5', title: 'Inspection Report', desc: 'Generates CDSCO GCP inspection reports with CAPA plans, observation classification, and Schedule Y citations.', tag: 'Compliance' },
              { n: 'M6', title: 'Regulatory Q&A', desc: 'RAG-powered assistant grounded in NDCTR 2019, Schedule Y, ICH guidelines, and ICMR ethics corpus.', tag: 'Knowledge' },
              { n: 'M7', title: 'Schedule Y Compliance', desc: 'Deep compliance checks across Schedule Y Appendices I-XI and NDCTR 2019 Rules 1-105.', tag: 'Knowledge' },
              { n: 'M8', title: 'ICH E6(R3) GCP', desc: 'Full GCP evaluation against ICH E6(R3) including R3-specific QMS and Risk-Based Monitoring gaps.', tag: 'Knowledge' },
            ].map((agent) => (
              <div
                key={agent.n}
                className="agent-card group fade-up rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-300 hover:border-teal-200 hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-600">{agent.n}</span>
                  <span className="text-xs text-gray-400">{agent.tag}</span>
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900 transition-colors group-hover:text-teal-700">
                  {agent.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">{agent.desc}</p>
              </div>
            ))}
          </div>

          <div className="fade-up mt-12 text-center">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-4 font-semibold text-white shadow-lg transition-colors hover:bg-teal-700"
            >
              Access All 8 Agents Free
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="fade-up mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-600">Process</div>
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              From Upload to Compliance Report in Minutes
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="absolute left-[12.5%] right-[12.5%] top-10 hidden h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent md:block"></div>
            {[
              { n: '01', title: 'Upload', desc: 'Upload PDF or DOCX, clinical protocol, ICF, SAE narrative, or any regulatory document.' },
              { n: '02', title: 'Analyse', desc: 'AI cross-references against NDCTR 2019, Schedule Y, and ICH guidelines via RAG pipeline.' },
              { n: '03', title: 'Report', desc: 'Receive per-section compliance status with specific gap analysis and regulatory citations.' },
              { n: '04', title: 'Review', desc: 'Export for review by qualified RA professionals before CDSCO submission.' },
            ].map((step) => (
              <div key={step.n} className="fade-up text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-sm font-bold text-white shadow-lg">
                  {step.n}
                </div>
                <h4 className="mb-2 text-lg font-bold text-gray-900">{step.title}</h4>
                <p className="text-sm leading-relaxed text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="solutions" className="relative overflow-hidden bg-gray-900 py-24 text-white">
        <div className="pointer-events-none absolute bottom-0 right-0 select-none text-[400px] font-black leading-none text-white/[0.02]">
          R
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="fade-up mb-16">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-400">Solutions</div>
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Built for the Indian Pharma Ecosystem
            </h2>
          </div>

          <div className="grid gap-10 lg:grid-cols-3">
            {[
              { n: '01', title: 'Pharmaceutical Companies', desc: 'Automate pre-submission compliance checks before CDSCO filing. Reduce review cycles and accelerate time-to-approval across concurrent trials.' },
              { n: '02', title: 'Contract Research Organisations', desc: 'Speed up protocol reviews, SAE classification, and query responses. Handle higher documentation volumes with consistent quality.' },
              { n: '03', title: 'RA Consultants & Firms', desc: 'Handle more client engagements with AI-assisted compliance reviews. Deliver faster turnaround with comprehensive audit trails.' },
            ].map((item) => (
              <div key={item.title} className="fade-up rounded-2xl border border-white/10 p-8 transition-colors hover:border-teal-500/50">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-sm font-bold tracking-widest text-teal-400">
                  {item.n}
                </div>
                <h3 className="mb-4 text-xl font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="trust" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            <div className="fade-up">
              <div className="mb-4 text-xs font-bold uppercase tracking-widest text-teal-600">Trust & Security</div>
              <h2 className="mb-6 text-4xl font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Built for Regulatory Trust
              </h2>
              <p className="mb-8 leading-relaxed text-gray-500">
                RegCheck-India processes all documents through the Anthropic Claude API. Anthropic does not
                use API inputs or outputs for model training. Data is automatically deleted from Anthropic
                servers within 7 days. Your proprietary formulations, clinical data, and patient information
                remain fully protected.
              </p>
              <div className="space-y-3">
                {[
                  'All outputs clearly marked as AI-generated',
                  'Every finding cited to specific regulatory source',
                  'Designed for professional review before use',
                  'Never to be submitted to CDSCO without RA sign-off',
                  'PII/PHI detection on all processed documents',
                  'DPDP Act 2023 compliant data handling',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50">
                      <svg className="h-3 w-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fade-up grid grid-cols-2 gap-4">
              {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'DPDP Act 2023', 'NDHM Guidelines', 'ICMR Ethics'].map((framework) => (
                <div key={framework} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100">
                    <svg className="h-4 w-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{framework}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="contact" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="fade-up mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-600">Get in Touch</div>
            <h2 className="mb-4 text-4xl font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Request Demo or Pilot Access
            </h2>
            <p className="mx-auto max-w-xl text-gray-500">
              Be among the first Indian pharmaceutical companies, CROs, and RA consultancies to
              automate your regulatory workflow with RegCheck-India.
            </p>
          </div>

          <div className="fade-up overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="grid lg:grid-cols-5">
              <div className="bg-teal-600 p-10 text-white lg:col-span-2">
                <h3 className="mb-6 text-xl font-bold">Why RegCheck-India?</h3>
                <div className="space-y-6">
                  {[
                    { 
                      icon: (
                        <svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ), 
                      title: 'Free Pilot', 
                      desc: 'No commitment during pilot phase' 
                    },
                    { 
                      icon: (
                        <svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      ), 
                      title: 'India-First', 
                      desc: 'Built on CDSCO & NDCTR 2019 corpus' 
                    },
                    { 
                      icon: (
                        <svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ), 
                      title: 'Claude-Powered', 
                      desc: '8 specialised regulatory agents' 
                    },
                    { 
                      icon: (
                        <svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ), 
                      title: 'Secure', 
                      desc: 'DPDP Act 2023 compliant' 
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{item.title}</div>
                        <div className="text-teal-200 text-xs mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 border-t border-teal-500 pt-8">
                  <div className="mb-2 text-xs text-teal-200">Direct founder contact</div>
                  <a href="mailto:rushikeshbork000@gmail.com" className="text-sm font-medium text-white transition-colors hover:text-teal-200">
                    rushikeshbork000@gmail.com
                  </a>
                </div>
              </div>

              <div className="p-4 lg:col-span-3">
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSelrgr29tF7x115l80KIWfQvXMz5HIPuujB8r_e2MKm0AJolQ/viewform?embedded=true"
                  width="100%"
                  height="600"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  className="rounded-xl"
                  title="RegCheck-India Contact Form"
                >
                  Loading form...
                </iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 pt-16 pb-8 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 grid grid-cols-1 gap-12 border-b border-white/10 pb-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
                  <span className="text-sm font-black text-white">R</span>
                </div>
                <span className="text-lg font-bold">RegCheck-India</span>
              </div>
              <p className="mb-6 max-w-sm text-sm leading-relaxed text-gray-400">
                Bridging pharmaceutical domain expertise and regulatory velocity through Claude-powered
                AI agents, built from inside India&apos;s pharma ecosystem.
              </p>
              <div className="flex gap-3">
                <a
                  href="https://github.com/nerd-maker/Regcheck-India"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-teal-600"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.72-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
                <a
                  href="mailto:rushikeshbork000@gmail.com"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-teal-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h5 className="mb-4 text-sm font-semibold text-gray-300">Platform</h5>
              <ul className="space-y-3">
                {['PII Anonymiser', 'Document Summariser', 'Case Classifier', 'Schedule Y Compliance', 'ICH E6(R3) GCP', 'Regulatory Q&A'].map((label) => (
                  <li key={label}>
                    <Link href="/app" className="text-sm text-gray-500 transition-colors hover:text-teal-400">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h5 className="mb-4 text-sm font-semibold text-gray-300">Regulatory Frameworks</h5>
              <ul className="space-y-3">
                {['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'CDSCO GCP', 'DPDP Act 2023'].map((label) => (
                  <li key={label}>
                    <span className="text-sm text-gray-500">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-teal-600/20 px-3 py-1 text-xs font-medium text-teal-400">v3.0.0</span>
              <span className="text-xs text-gray-600">8 agents live | Claude-powered | Deployed on Vercel + Render</span>
            </div>
            <p className="text-xs text-gray-600">© 2025 RegCheck-India. Built for India&apos;s pharmaceutical ecosystem.</p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-700">
              Pilot tool. All outputs must be reviewed by qualified RA professionals before regulatory submission to CDSCO.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

