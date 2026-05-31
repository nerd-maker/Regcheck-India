'use client'

import { ReactNode } from 'react'

export interface FilterChip {
  id: string
  label: string
  count?: number
}

interface FilterBarProps {
  filters?: { key: string; label: string; chips: FilterChip[] }[]
  active: Record<string, string>          // key → selected chipId ('' = all)
  onChange: (next: Record<string, string>) => void
  search?: string
  onSearch?: (s: string) => void
  searchPlaceholder?: string
  right?: ReactNode
}

/**
 * Inline filter chip bar — lighter-weight alternative to the full faceted
 * sidebar. Single selection per group, plus optional search box.
 */
export default function FilterBar({
  filters = [], active, onChange,
  search, onSearch, searchPlaceholder = 'Search…',
  right,
}: FilterBarProps) {
  return (
    <div style={{
      padding: '10px 24px',
      background: 'var(--rc-surface)',
      borderBottom: '1px solid var(--rc-divider)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
      alignItems: 'center',
    }} data-testid="filter-bar">
      {filters.map(group => (
        <div key={group.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>{group.label}</span>
          <button
            className={`rc-btn rc-btn-sm ${!active[group.key] ? 'rc-btn-primary' : ''}`}
            onClick={() => onChange({ ...active, [group.key]: '' })}
            data-testid={`filterchip-${group.key}-all`}
          >All</button>
          {group.chips.map(c => (
            <button
              key={c.id}
              className={`rc-btn rc-btn-sm ${active[group.key] === c.id ? 'rc-btn-primary' : ''}`}
              onClick={() => onChange({ ...active, [group.key]: c.id })}
              data-testid={`filterchip-${group.key}-${c.id}`}
            >
              {c.label}{c.count !== undefined ? ` · ${c.count}` : ''}
            </button>
          ))}
        </div>
      ))}
      {onSearch !== undefined && (
        <div style={{ position: 'relative', minWidth: 220, flex: '0 1 280px', marginLeft: 'auto' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--rc-text-muted)', fontSize: 13 }}/>
          <input
            className="rc-input"
            value={search ?? ''}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ paddingLeft: 28 }}
            data-testid="filter-search"
          />
        </div>
      )}
      {right && <div style={{ display: 'flex', gap: 6 }}>{right}</div>}
    </div>
  )
}
