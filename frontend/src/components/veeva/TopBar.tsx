'use client'

import Link from 'next/link'

export default function TopBar() {
  return (
    <div className="rc-topbar" data-testid="top-app-bar">
      <Link href="/" className="rc-topbar-logo" data-testid="topbar-logo">
        <span className="rc-topbar-logo-mark">R</span>
        <span>RegCheck<span style={{ opacity: 0.55, fontWeight: 400 }}>·India</span></span>
      </Link>

      <button className="rc-topbar-vault" data-testid="topbar-vault-picker">
        <i className="ti ti-database"/>
        <span>India Regulatory Vault</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 12 }}/>
      </button>

      <div className="rc-topbar-search">
        <i className="ti ti-search rc-topbar-search-icon"/>
        <input
          type="text"
          placeholder="Search submissions, documents, applications…"
          data-testid="topbar-global-search"
        />
      </div>

      <div className="rc-topbar-actions">
        <button className="rc-topbar-icon-btn" title="New submission" data-testid="topbar-new-btn">
          <i className="ti ti-plus"/>
        </button>
        <button className="rc-topbar-icon-btn" title="Quick actions" data-testid="topbar-quick">
          <i className="ti ti-bolt"/>
        </button>
        <button className="rc-topbar-icon-btn" title="Help" data-testid="topbar-help">
          <i className="ti ti-help-circle"/>
        </button>
        <button className="rc-topbar-icon-btn" title="Notifications" data-testid="topbar-notifications">
          <i className="ti ti-bell"/>
          <span className="badge-dot"/>
        </button>

        <div className="rc-topbar-user" data-testid="topbar-user">
          <div className="rc-avatar" aria-hidden="true">AS</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Anika Sharma</div>
            <div style={{ fontSize: 10.5, opacity: 0.7 }}>Regulatory Lead</div>
          </div>
          <i className="ti ti-chevron-down" style={{ fontSize: 11, opacity: 0.7 }}/>
        </div>
      </div>
    </div>
  )
}
