'use client'

import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import { getRawStoredKey, storeKey, getSarvamKey, storeSarvamKey } from '@/services/api'

export default function SettingsView({ section }: { section: 'settings' | 'apikeys' }) {
  const { setActiveView } = useWorkspace()
  const [tab, setTab] = useState<'general' | 'team' | 'security' | 'integrations'>(
    section === 'apikeys' ? 'integrations' : 'general'
  )

  return (
    <div data-testid={`view-${section}`}>
      <PageHeader
        crumbs={[
          { label: 'Workspace', onClick: () => setActiveView('home') },
          { label: section === 'apikeys' ? 'API & Vaults' : 'Settings' },
        ]}
        title={section === 'apikeys' ? 'API & Vaults' : 'Workspace Settings'}
        subtitle="Configure your vault, team, and integrations"
        icon={section === 'apikeys' ? 'ti-key' : 'ti-settings'}
        tabs={[
          { id: 'general',      label: 'General' },
          { id: 'team',         label: 'Team & Roles' },
          { id: 'security',     label: 'Security & Compliance' },
          { id: 'integrations', label: 'Integrations' },
        ]}
        activeTab={tab}
        onTabChange={(t) => setTab(t as any)}
      />

      <div style={{ padding: 24, maxWidth: 760 }}>
        {tab === 'general'      && <GeneralTab/>}
        {tab === 'team'         && <TeamTab/>}
        {tab === 'security'     && <SecurityTab/>}
        {tab === 'integrations' && <IntegrationsTab/>}
      </div>
    </div>
  )
}

// ── General ──────────────────────────────────────────────────────────────────
function GeneralTab() {
  return (
    <div className="rc-card">
      <div className="rc-card-header"><span>Vault preferences</span></div>
      <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Vault name" value="India Regulatory Vault"/>
        <Field label="Default authority" value="CDSCO (India)"/>
        <Field label="Time zone" value="Asia/Kolkata (IST · UTC+05:30)"/>
        <Field label="Date format" value="YYYY-MM-DD"/>
      </div>
    </div>
  )
}

// ── Team ─────────────────────────────────────────────────────────────────────
function TeamTab() {
  return (
    <div className="rc-card">
      <div className="rc-card-header">
        <span>Members</span>
        <button className="rc-btn rc-btn-primary rc-btn-sm"><i className="ti ti-user-plus"/> Invite</button>
      </div>
      <table className="rc-table">
        <thead><tr><th>Member</th><th>Role</th><th>Last seen</th></tr></thead>
        <tbody>
          {[
            { n: 'Anika Sharma',    r: 'Regulatory Lead',  i: 'AS', s: 'Online' },
            { n: 'Rajat Iyer',      r: 'CMC Lead',         i: 'RI', s: '5 min ago' },
            { n: 'Dr. Priya Menon', r: 'Clinical Lead',    i: 'PM', s: '1 hour ago' },
            { n: 'Karan Bhatt',     r: 'Pharmacovigilance',i: 'KB', s: 'yesterday' },
            { n: 'Meera Nair',      r: 'Quality Assurance',i: 'MN', s: '2 days ago' },
          ].map((m, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="rc-avatar" style={{ width: 24, height: 24, fontSize: 10, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{m.i}</div>
                  <span>{m.n}</span>
                </div>
              </td>
              <td>{m.r}</td>
              <td><span style={{ fontSize: 12, color: 'var(--rc-text-muted)' }}>{m.s}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Security ─────────────────────────────────────────────────────────────────
function SecurityTab() {
  return (
    <div className="rc-card">
      <div className="rc-card-header"><span>Security & compliance</span></div>
      <div className="rc-card-body" style={{ fontSize: 13, color: 'var(--rc-text-secondary)', lineHeight: 1.7 }}>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>SSO: <strong style={{ color: 'var(--rc-text-primary)' }}>Okta SAML 2.0</strong> — connected</li>
          <li>Data residency: <strong style={{ color: 'var(--rc-text-primary)' }}>Mumbai (ap-south-1)</strong></li>
          <li>Encryption at rest: <strong style={{ color: 'var(--rc-text-primary)' }}>AES-256</strong></li>
          <li>e-Signatures: <strong style={{ color: 'var(--rc-text-primary)' }}>21 CFR Part 11 compliant</strong></li>
          <li>Audit trail retention: <strong style={{ color: 'var(--rc-text-primary)' }}>10 years</strong></li>
          <li>DPDP Act 2023: PII auto-detection enabled across all documents</li>
        </ul>
      </div>
    </div>
  )
}

// ── Integrations (real key management) ───────────────────────────────────────
function IntegrationsTab() {
  return (
    <>
      <div className="rc-card" style={{ marginBottom: 16 }}>
        <div className="rc-card-header">
          <span>API keys</span>
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>
            Stored locally · obfuscated in localStorage
          </span>
        </div>
        <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KeyInput
            label="Anthropic API key"
            description="Used by all 9 compliance agents. Leave blank to use the vault's shared server-side key (good for demos and previews — uses the vault owner's Anthropic credits)."
            getter={getRawStoredKey}
            setter={storeKey}
            placeholder="sk-ant-…"
            testid="anthropic-key"
          />
          <KeyInput
            label="Sarvam AI API key (optional)"
            description="Required only for the meeting-transcription agent (Hindi STT). Not required for compliance checks."
            getter={getSarvamKey}
            setter={storeSarvamKey}
            placeholder="sk-sarvam-…"
            testid="sarvam-key"
          />
        </div>
      </div>

      <div className="rc-card">
        <div className="rc-card-header"><span>Connected services</span></div>
        <div className="rc-card-body">
          {[
            { name: 'Anthropic Claude API',  status: 'Connected',     icon: 'ti-brain',         sub: 'Powers all 9 compliance agents' },
            { name: 'CDSCO SUGAM Portal',    status: 'Not connected', icon: 'ti-building-bank', sub: 'Direct submission API (manual upload until connected)' },
            { name: 'Sarvam AI (Hindi STT)', status: 'Not connected', icon: 'ti-microphone',    sub: 'Meeting transcription for Hindi-language sessions' },
            { name: 'DocuSign e-Signatures', status: 'Connected',     icon: 'ti-writing-sign',  sub: '21 CFR Part 11 compliant' },
          ].map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--rc-divider)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--rc-primary-soft)', color: 'var(--rc-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${it.icon}`} style={{ fontSize: 16 }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)' }}>{it.sub}</div>
              </div>
              <span className={`rc-pill ${it.status === 'Connected' ? 'rc-pill-approved' : 'rc-pill-draft'}`}>{it.status}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Reusable key input ───────────────────────────────────────────────────────
function KeyInput({
  label, description, getter, setter, placeholder, testid,
}: {
  label: string
  description?: string
  getter: () => string
  setter: (k: string) => void
  placeholder: string
  testid: string
}) {
  const [value, setValue] = useState('')
  const [shown, setShown] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saved'>('idle')
  const [editing, setEditing] = useState(false)
  const [stored, setStored] = useState('')

  useEffect(() => {
    const v = getter()
    setStored(v)
    if (!v) setEditing(true)
  }, [getter])

  const masked = stored ? `${stored.slice(0, 6)}${'•'.repeat(Math.max(0, stored.length - 10))}${stored.slice(-4)}` : ''

  const save = () => {
    setter(value.trim())
    setStored(value.trim())
    setValue('')
    setEditing(false)
    setSaved('saved')
    setTimeout(() => setSaved('idle'), 2200)
  }

  const clear = () => {
    setter('')
    setStored('')
    setValue('')
    setEditing(true)
  }

  return (
    <div>
      <label className="rc-label">{label}</label>
      {!editing && stored ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="rc-input" style={{ fontFamily: 'var(--rc-font-mono)', fontSize: 12, color: 'var(--rc-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span data-testid={`${testid}-masked`}>{shown ? stored : masked}</span>
            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setShown(s => !s)} style={{ padding: 0 }}>
              <i className={`ti ${shown ? 'ti-eye-off' : 'ti-eye'}`}/>
            </button>
          </div>
          <button className="rc-btn rc-btn-sm" onClick={() => setEditing(true)} data-testid={`${testid}-edit`}>
            <i className="ti ti-edit"/> Replace
          </button>
          <button className="rc-btn rc-btn-sm rc-btn-danger" onClick={clear} data-testid={`${testid}-clear`}>
            <i className="ti ti-trash"/> Clear
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="password" autoComplete="off"
            className="rc-input"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            data-testid={`${testid}-input`}
          />
          <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!value.trim()} onClick={save} data-testid={`${testid}-save`}>
            <i className="ti ti-device-floppy"/> Save
          </button>
          {stored && (
            <button className="rc-btn rc-btn-sm" onClick={() => { setEditing(false); setValue(''); }}>Cancel</button>
          )}
        </div>
      )}
      {description && (
        <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 6, lineHeight: 1.5 }}>{description}</div>
      )}
      {saved === 'saved' && (
        <div style={{ fontSize: 11.5, color: 'var(--rc-approved)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }} data-testid={`${testid}-saved`}>
          <i className="ti ti-circle-check"/> Saved
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="rc-label">{label}</label>
      <input className="rc-input" defaultValue={value}/>
    </div>
  )
}
