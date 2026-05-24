'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import DemoRequestModal from '@/components/DemoRequestModal'

// ─── Inline animation tokens (kept here so the landing is self-contained) ───
const NAVY = '#0B2A5B'
const NAVY_2 = '#122E66'
const BLUE = '#1A56DB'

function useCountUp(target: number, duration = 1600, trigger = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start: number | null = null
    let animationFrameId: number
    const step = (ts: number) => {
      if (start === null) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setCount(Math.floor(p * target))
      if (p < 1) {
        animationFrameId = requestAnimationFrame(step)
      }
    }
    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [trigger, target, duration])
  return count
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const statsRef = useRef<HTMLDivElement | null>(null)
  const submissions = useCountUp(2400, 1200, statsVisible)
  const agents = useCountUp(8, 900, statsVisible)
  const frameworks = useCountUp(12, 1200, statsVisible)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.05 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible') })
    }, { threshold: 0.1 })
    document.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ background: '#fff', color: '#0F1419', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .grid-bg {
          background-image:
            linear-gradient(rgba(11, 42, 91, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(11, 42, 91, 0.04) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .marquee-track { display: flex; width: max-content; animation: marquee 38s linear infinite; }
        @keyframes float-card { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .float-card { animation: float-card 5s ease-in-out infinite; }
      `}</style>

      {/* Top announcement strip */}
      <div style={{ background: NAVY, color: '#DCE5F4', fontSize: 12, padding: '7px 16px', textAlign: 'center' }}>
        <span style={{ color: '#7DD3FC', fontWeight: 600, marginRight: 8 }}>NEW</span>
        ICH E6(R3) GCP module now live · CDSCO SUGAM integration in private preview
        <span style={{ marginLeft: 8, opacity: 0.6 }}>·</span>
        <a href="#platform" style={{ marginLeft: 8, color: '#fff', textDecoration: 'underline', textUnderlineOffset: 2 }}>Read more →</a>
      </div>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(255,255,255,0.92)' : '#fff',
        borderBottom: scrolled ? '1px solid #E1E5EB' : '1px solid transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : undefined,
        transition: 'background 200ms, border-color 200ms',
      }}>
        <nav style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0F1419' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: `linear-gradient(135deg, #4F8DF7 0%, ${BLUE} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 14,
              boxShadow: '0 2px 8px rgba(26, 86, 219, 0.25)',
            }}>R</div>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              RegCheck<span style={{ color: '#9CA3AF', fontWeight: 400 }}>·India</span>
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 28, fontSize: 13, fontWeight: 500, color: '#4B5563' }}>
            <a href="#platform"   style={{ textDecoration: 'none', color: 'inherit' }}>Platform</a>
            <a href="#workflow"   style={{ textDecoration: 'none', color: 'inherit' }}>Workflow</a>
            <a href="#frameworks" style={{ textDecoration: 'none', color: 'inherit' }}>Frameworks</a>
            <a href="#security"   style={{ textDecoration: 'none', color: 'inherit' }}>Security</a>
            <a href="#contact"    style={{ textDecoration: 'none', color: 'inherit' }}>Contact</a>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, color: '#4B5563', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Request Demo</button>
            <Link href="/app" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#fff',
              background: NAVY, padding: '8px 16px', borderRadius: 4,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(11, 42, 91, 0.18)',
            }}>
              Open Vault <span>→</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }} className="grid-bg">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 72px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(26, 86, 219, 0.08)',
              color: NAVY, fontSize: 11.5, fontWeight: 600,
              border: '1px solid rgba(26, 86, 219, 0.15)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }}/>
              Built for CDSCO · DCGI · State FDA
            </div>

            <h1 style={{
              fontSize: 52, fontWeight: 700, lineHeight: 1.05,
              letterSpacing: '-0.025em', margin: '24px 0 18px',
              color: '#0F1419',
            }}>
              The regulatory <span style={{ color: NAVY }}>information management</span> platform for Indian pharma.
            </h1>

            <p style={{ fontSize: 16.5, color: '#4B5563', lineHeight: 1.6, maxWidth: 560, margin: '0 0 30px' }}>
              Submissions, applications, registrations, and HA correspondence — unified in a single vault, accelerated by eight specialised AI compliance agents trained on India&apos;s regulatory corpus.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <Link href="/app" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: NAVY, color: '#fff', padding: '12px 22px',
                borderRadius: 5, fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(11, 42, 91, 0.22)',
              }}>
                Open the Vault →
              </Link>
              <button onClick={() => setModalOpen(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#fff', color: '#0F1419', padding: '12px 22px',
                borderRadius: 5, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', border: '1px solid #D6DBE3',
              }}>
                Request a Pilot →
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 44, fontStyle: 'italic' }}>
              30-min product walkthrough · No commitment · RA team welcome
            </div>

            <div ref={statsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, borderTop: '1px solid #E1E5EB', paddingTop: 24, maxWidth: 540 }}>
              <Stat label="Compliance checks" value={`${submissions.toLocaleString()}+`}/>
              <Stat label="AI agents" value={`${agents}`}/>
              <Stat label="Frameworks indexed" value={`${frameworks}`}/>
            </div>
          </div>

          {/* Hero — mock workspace preview */}
          <div className="float-card" style={{
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 24px 60px rgba(11, 42, 91, 0.16)',
            border: '1px solid #E1E5EB',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Mock topbar */}
            <div style={{ background: NAVY, height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: `linear-gradient(135deg,#4F8DF7,${BLUE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>R</div>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>India Regulatory Vault</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}/>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}/>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}/>
              </div>
            </div>
            {/* Mock subbar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #ECEEF2', padding: '8px 14px', fontSize: 10, color: '#6B7280', display: 'flex', gap: 14 }}>
              <span style={{ color: BLUE, fontWeight: 700, borderBottom: `2px solid ${BLUE}`, paddingBottom: 7, marginBottom: -8 }}>Overview</span>
              <span>Documents <span style={{ background: '#F0F2F5', padding: '0 5px', borderRadius: 6, fontSize: 9 }}>18</span></span>
              <span>HA Correspondence</span>
              <span>Compliance Gaps <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0 5px', borderRadius: 6, fontSize: 9 }}>4</span></span>
            </div>
            {/* Mock content */}
            <div style={{ padding: 14, background: '#F7F8FA' }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>RC-SUB-2025-0042</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#0F1419' }}>ZP-101 · IND Application — Phase II</div>

              {/* Lifecycle strip */}
              <div style={{ display: 'flex', background: '#fff', border: '1px solid #E1E5EB', borderRadius: 5, overflow: 'hidden', marginBottom: 14 }}>
                {['Draft', 'In Review', 'Approved', 'Submitted'].map((s, i) => {
                  const done = i < 1, cur = i === 1
                  return (
                    <div key={s} style={{
                      flex: 1, padding: '7px 8px', fontSize: 10, fontWeight: 600,
                      background: done ? '#F0F7EE' : cur ? BLUE : '#fff',
                      color: done ? '#15803D' : cur ? '#fff' : '#9CA3AF',
                      borderRight: i < 3 ? '1px solid #ECEEF2' : 'none',
                      textAlign: 'center',
                    }}>{i + 1}. {s}</div>
                  )
                })}
              </div>

              {/* Document rows */}
              {[
                { n: 'DOC-0042', t: 'ZP-101 Protocol v2.1',            st: 'In Review', sc: 72, c: '#B45309', bg: '#FEF3C7' },
                { n: 'DOC-0043', t: 'ZP-101 Informed Consent Form',    st: 'In Review', sc: 88, c: '#15803D', bg: '#DCFCE7' },
                { n: 'DOC-0044', t: 'ZP-101 Investigator Brochure',    st: 'Approved',  sc: 95, c: '#15803D', bg: '#DCFCE7' },
                { n: 'DOC-0045', t: 'ZP-101 CMC Stability Data',       st: 'Draft',     sc: 56, c: '#B91C1C', bg: '#FEE2E2' },
              ].map(r => (
                <div key={r.n} style={{ background: '#fff', border: '1px solid #E1E5EB', borderRadius: 4, padding: '8px 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'JetBrains Mono, monospace', width: 64 }}>{r.n}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, flex: 1, color: '#0F1419' }}>{r.t}</div>
                  <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 999, background: r.bg, color: r.c, fontWeight: 700 }}>{r.st}</span>
                  <div style={{ width: 50, height: 4, background: '#ECEEF2', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${r.sc}%`, height: '100%', background: r.c }}/>
                  </div>
                  <div style={{ fontSize: 10, color: '#0F1419', fontWeight: 600, width: 26, textAlign: 'right' }}>{r.sc}%</div>
                </div>
              ))}

              {/* AI action banner */}
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(26,86,219,0.08)', border: '1px solid rgba(26,86,219,0.18)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>✦</div>
                <div style={{ fontSize: 10.5, color: NAVY, fontWeight: 500 }}>
                  AI flagged dose mismatch — Protocol v2.1 says <strong>400 mg</strong> but ICF v1.4 shows <strong>200 mg</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Framework marquee */}
        <div style={{ borderTop: '1px solid #E1E5EB', borderBottom: '1px solid #E1E5EB', background: '#F7F8FA', padding: '20px 0', overflow: 'hidden' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', flexShrink: 0 }}>Aligned with</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="marquee-track">
                {['NDCTR 2019', 'Schedule Y', 'Schedule M', 'ICH E6(R3)', 'ICH E2A', 'ICH E3', 'ICH E9', 'CDSCO GCP', 'CTRI', 'DPDP Act 2023', 'NDHM', 'ICMR Ethics', 'D&C Act 1940', 'PvPI', 'NDCTR 2019', 'Schedule Y', 'Schedule M', 'ICH E6(R3)', 'ICH E2A', 'ICH E3', 'ICH E9', 'CDSCO GCP', 'CTRI', 'DPDP Act 2023', 'NDHM', 'ICMR Ethics', 'D&C Act 1940', 'PvPI'].map((f, i) => (
                  <span key={i} style={{ margin: '0 14px', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: '#4B5563', padding: '4px 12px', background: '#fff', border: '1px solid #E1E5EB', borderRadius: 3 }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" style={{ padding: '88px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="fade-up" style={{ maxWidth: 720, marginBottom: 56 }}>
            <Eyebrow>Platform</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', margin: '12px 0 16px', lineHeight: 1.1 }}>
              One vault. Every regulatory artefact. Eight specialised AI agents.
            </h2>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.7, margin: 0 }}>
              Submissions, applications, registrations, HA correspondence, and an immutable audit trail — managed in a single vault with the structure Indian regulatory teams need to file with confidence.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: 'M5 8v12a2 2 0 002 2h10a2 2 0 002-2V8M5 8l7-5 7 5M5 8h14',
                title: 'Submission management',
                desc: 'Lifecycle states (Draft → In Review → Approved → Submitted), CDSCO eCTD-lite structure, deficiency tracking, and target-submit calendars.' },
              { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                title: 'Document control',
                desc: 'Versioned documents with classification, ownership, lifecycle, and 21 CFR Part 11 compliant e-signatures.' },
              { icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                title: 'AI compliance actions',
                desc: 'Run Schedule Y, ICH E6(R3), PII anonymisation, cross-doc consistency, SAE classification and more — directly on any document.' },
              { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                title: 'HA correspondence',
                desc: 'Track inbound and outbound communication with CDSCO, DCGI, and State FDA. Due-date alerts, deficiency response drafting.' },
              { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                title: 'Audit-trail by default',
                desc: 'Immutable activity log. 21 CFR Part 11, DPDP Act 2023, and ICH E6(R3) §4 ready out of the box.' },
              { icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z',
                title: 'Reports & analytics',
                desc: 'Vault-wide compliance dashboards, submission throughput, gap density, and team performance.' },
            ].map((f, i) => (
              <div key={i} className="fade-up" style={{ border: '1px solid #E1E5EB', borderRadius: 8, padding: 26, background: '#fff', transition: 'border-color 200ms, box-shadow 200ms' }}>
                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(26,86,219,0.08)', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon}/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F1419', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" style={{ padding: '88px 24px', background: '#F7F8FA', borderTop: '1px solid #E1E5EB', borderBottom: '1px solid #E1E5EB' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="fade-up" style={{ marginBottom: 48, maxWidth: 720 }}>
            <Eyebrow>Workflow</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', margin: '12px 0 16px', lineHeight: 1.1 }}>From draft to CDSCO filing in a single pipeline.</h2>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.7, margin: 0 }}>
              The vault tracks every regulatory artefact through a structured lifecycle. AI compliance actions sit at every gate, flagging issues before they reach the Authority.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { n: '01', t: 'Capture',  d: 'Upload protocols, ICFs, SAE narratives and inspection reports. AI auto-extracts metadata and section structure.' },
              { n: '02', t: 'Evaluate', d: 'Run AI compliance actions — Schedule Y, ICH E6(R3), PII, cross-doc consistency, SAE classification — all cited.' },
              { n: '03', t: 'Resolve',  d: 'Address CRITICAL / MAJOR / MINOR gaps with AI-suggested remediations. Loop in CMC, Clinical, PV as needed.' },
              { n: '04', t: 'Submit',   d: 'e-Sign in-vault (21 CFR Part 11). Export to CDSCO eCTD-lite. Track deficiency letters with due-date alerts.' },
            ].map(s => (
              <div key={s.n} className="fade-up" style={{ background: '#fff', borderRadius: 8, padding: 22, border: '1px solid #E1E5EB' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 14, fontFamily: 'JetBrains Mono, monospace' }}>{s.n} / 04</div>
                <h4 style={{ fontSize: 16, fontWeight: 600, color: '#0F1419', margin: '0 0 8px' }}>{s.t}</h4>
                <p style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.65, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FRAMEWORKS / SECURITY (split) */}
      <section id="security" style={{ padding: '88px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'flex-start' }}>
          <div className="fade-up">
            <Eyebrow>Security & compliance</Eyebrow>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', margin: '12px 0 16px', lineHeight: 1.15 }}>Built for regulatory trust.</h2>
            <p style={{ fontSize: 14.5, color: '#4B5563', lineHeight: 1.7, margin: '0 0 24px' }}>
              RegCheck-India is engineered for the data-residency and integrity expectations of Indian pharmaceutical regulators. Documents stay in your vault, AI inference traffic is contained, and every action is auditable.
            </p>
            {[
              ['Data residency · Mumbai (ap-south-1)',                'AES-256 at rest · TLS 1.3 in transit'],
              ['21 CFR Part 11 e-Signatures',                          'Tamper-evident audit trail · 10-year retention'],
              ['DPDP Act 2023 compliant',                              'PII auto-detection on every uploaded document'],
              ['Role-based access · SAML SSO (Okta, Azure AD)',        'SCIM-provisioned · MFA enforced'],
              ['AI outputs cited and human-review gated',              'All findings linked to NDCTR / Schedule Y / ICH source'],
            ].map(([a, b], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: i < 4 ? '1px solid #ECEEF2' : 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(21, 128, 61, 0.10)', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F1419' }}>{a}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{b}</div>
                </div>
              </div>
            ))}
          </div>

          <div id="frameworks" className="fade-up">
            <Eyebrow>Regulatory corpus</Eyebrow>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', margin: '12px 0 24px', lineHeight: 1.15 }}>12 frameworks. Indexed. Cited.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { code: 'NDCTR 2019',    body: 'New Drugs and Clinical Trials Rules' },
                { code: 'Schedule Y',    body: 'Indian clinical trial requirements' },
                { code: 'Schedule M',    body: 'GMP for India manufacturing' },
                { code: 'ICH E6(R3)',    body: 'Good Clinical Practice — R3' },
                { code: 'ICH E2A',       body: 'Clinical Safety Data Management' },
                { code: 'ICH E3',        body: 'Clinical Study Reports' },
                { code: 'CDSCO GCP',     body: 'CDSCO GCP guidelines (India)' },
                { code: 'DPDP Act 2023', body: 'Digital Personal Data Protection' },
                { code: 'CTRI',          body: 'Clinical Trials Registry – India' },
                { code: 'ICMR Ethics',   body: 'ICMR Bioethics 2017' },
                { code: 'PvPI',          body: 'Pharmacovigilance Programme of India' },
                { code: 'NDHM',          body: 'National Digital Health Mission' },
              ].map(f => (
                <div key={f.code} style={{ padding: 14, border: '1px solid #E1E5EB', borderRadius: 6, background: '#fff' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 2 }}>{f.code}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7280' }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section style={{ background: NAVY, color: '#fff', padding: '88px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 60%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          <div className="fade-up" style={{ marginBottom: 48 }}>
            <Eyebrow color="#7DD3FC">Solutions</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', margin: '12px 0 0', lineHeight: 1.1 }}>
              Built for India&apos;s regulatory affairs teams.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { t: 'Pharmaceutical sponsors', d: 'Run pre-submission compliance checks across all CDSCO filings. Reduce review cycles. Accelerate time-to-IND across concurrent trials.' },
              { t: 'Contract Research Organisations', d: 'Speed up protocol reviews, SAE classification, and query response drafting. Handle higher documentation volume with consistent quality.' },
              { t: 'RA consultancies', d: 'Manage more client engagements with AI-assisted compliance reviews. Deliver faster turnaround with comprehensive audit trails.' },
            ].map((s, i) => (
              <div key={i} className="fade-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, borderRadius: 8 }}>
                <div style={{ width: 10, height: 10, background: '#7DD3FC', borderRadius: 2, marginBottom: 16 }}/>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{s.t}</h3>
                <p style={{ fontSize: 13, color: 'rgba(220, 229, 244, 0.75)', lineHeight: 1.65, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: '#F7F8FA', padding: '88px 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>Get started</Eyebrow>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', margin: '12px 0 14px', lineHeight: 1.1 }}>
            Move your regulatory program from spreadsheets to vault.
          </h2>
          <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.7, margin: '0 auto 32px', maxWidth: 600 }}>
            Be among the first Indian pharmaceutical sponsors and CROs to consolidate submissions, registrations, and HA correspondence into a single AI-assisted vault.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/app" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#fff', color: '#0F1419', padding: '14px 26px',
                borderRadius: 5, fontSize: 14, fontWeight: 600,
                textDecoration: 'none', border: '1px solid #D6DBE3',
              }}>Open the Vault →</Link>
              <button onClick={() => setModalOpen(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: NAVY, color: '#fff', padding: '14px 26px',
                borderRadius: 5, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                boxShadow: '0 6px 18px rgba(11, 42, 91, 0.22)',
              }}>Request a Pilot</button>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#6B7280' }}>
              Or email us directly: <a href="mailto:contact@regcheck.in" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>contact@regcheck.in</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0F1419', color: '#9CA3AF', padding: '48px 24px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 5, background: `linear-gradient(135deg,#4F8DF7,${BLUE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>R</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>RegCheck<span style={{ color: '#9CA3AF', fontWeight: 400 }}>·India</span></span>
            </div>
            <p style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.7, maxWidth: 320, margin: 0 }}>
              The regulatory information management platform built from inside India&apos;s pharmaceutical ecosystem. Powered by Anthropic Claude.
            </p>
          </div>
          {[
            { h: 'Platform',    items: ['Submissions', 'Documents', 'Registrations', 'Correspondence', 'Audit Trail'] },
            { h: 'Frameworks',  items: ['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A', 'DPDP Act 2023'] },
            { h: 'Company',     items: ['About', 'Security', 'Privacy', 'Terms', 'Contact'] },
          ].map(c => (
            <div key={c.h}>
              <h5 style={{ fontSize: 11.5, fontWeight: 700, color: '#D1D5DB', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>{c.h}</h5>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.items.map(i => <li key={i} style={{ fontSize: 12.5 }}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1280, margin: '0 auto', borderTop: '1px solid #1F2937', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11.5 }}>© 2025 RegCheck-India · v1.0 Beta · 8 agents live · All AI outputs require qualified RA review before CDSCO submission.</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/privacy" style={{ fontSize: 11.5, color: '#9CA3AF', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms"   style={{ fontSize: 11.5, color: '#9CA3AF', textDecoration: 'none' }}>Terms</Link>
            <a href="https://github.com/nerd-maker/Regcheck-India" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#9CA3AF', textDecoration: 'none' }}>GitHub</a>
          </div>
        </div>
      </footer>
      <DemoRequestModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function Eyebrow({ children, color = '#1A56DB' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color, marginBottom: 0,
    }}>{children}</div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#0F1419', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{label}</div>
    </div>
  )
}
