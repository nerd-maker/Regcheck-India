'use client'

import { useState, useEffect } from 'react'
import {
  RemediationTask,
  fetchRemediations,
  createRemediation,
  updateRemediation,
  deleteRemediation,
} from '@/services/workspaceData'

const SEVERITY_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  critical: { bg: 'var(--rc-rejected-bg)', text: 'var(--rc-rejected)' },
  major:    { bg: 'var(--rc-review-bg)',   text: 'var(--rc-review)'   },
  minor:    { bg: 'var(--rc-approved-bg)', text: 'var(--rc-approved)' },
}

const STATUS_LABELS: Record<
  string,
  { label: string; icon: string }
> = {
  'open':        { label: 'Open',        icon: 'ti-circle'       },
  'in-progress': { label: 'In Progress', icon: 'ti-clock'        },
  'resolved':    { label: 'Resolved',    icon: 'ti-circle-check' },
}

const PEOPLE_OPTIONS = [
  { name: 'Anika Sharma',    initials: 'AS' },
  { name: 'Rajat Iyer',      initials: 'RI' },
  { name: 'Dr. Priya Menon', initials: 'PM' },
  { name: 'Karan Bhatt',     initials: 'KB' },
  { name: 'Meera Nair',      initials: 'MN' },
  { name: 'Vikram Joshi',    initials: 'VJ' },
]

interface PendingGap {
  text: string
  severity: 'critical' | 'major' | 'minor'
  framework?: string
  sectionRef?: string
}

interface Props {
  submissionId?: string
  agentId?: string
  agentName?: string
  pendingGaps?: PendingGap[]
  agentRunId?: string
}

export function GapRemediationPanel({
  submissionId,
  agentId,
  agentName,
  pendingGaps = [],
  agentRunId,
}: Props) {
  const [tasks, setTasks] = useState<RemediationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'pending' | 'open' | 'resolved'>(
    pendingGaps.length > 0 ? 'pending' : 'open',
  )

  useEffect(() => {
    fetchRemediations(submissionId)
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [submissionId])

  const promote = async (gap: PendingGap, idx: number) => {
    if (!agentId || !agentName) return
    setPromoting((prev) => new Set(prev).add(idx))
    try {
      const task = await createRemediation({
        submission_id: submissionId,
        agent_id: agentId,
        agent_name: agentName,
        agent_run_id: agentRunId,
        gap_text: gap.text,
        severity: gap.severity,
        framework: gap.framework,
        section_ref: gap.sectionRef,
      })
      setTasks((prev) => [task, ...prev])
      setActiveTab('open')
    } finally {
      setPromoting((prev) => {
        const ns = new Set(prev)
        ns.delete(idx)
        return ns
      })
    }
  }

  const promoteAll = async () => {
    if (!agentId || !agentName) return
    for (let i = 0; i < pendingGaps.length; i++) {
      await promote(pendingGaps[i], i)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const updated = await updateRemediation(id, { status })
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  const updateOwner = async (
    id: string,
    ownerName: string,
    ownerInitials: string,
  ) => {
    const updated = await updateRemediation(id, {
      owner_name: ownerName,
      owner_initials: ownerInitials,
    })
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  const updateDueDate = async (id: string, dueDate: string) => {
    const updated = await updateRemediation(id, { due_date: dueDate })
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  const remove = async (id: string) => {
    await deleteRemediation(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const openTasks = tasks.filter(
    (t) => t.status === 'open' || t.status === 'in-progress',
  )
  const resolvedTasks = tasks.filter((t) => t.status === 'resolved')

  return (
    <div className="rc-card" style={{ marginTop: 16 }}>
      <div className="rc-card-header">
        <span>
          <i
            className="ti ti-list-check"
            style={{ marginRight: 6, color: 'var(--rc-primary)' }}
          />
          Gap Remediation Tasks
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['pending', 'open', 'resolved'] as const).map((tab) => (
            <button
              key={tab}
              className={`rc-btn rc-btn-sm ${activeTab === tab ? 'rc-btn-primary' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ textTransform: 'capitalize' }}
            >
              {tab}
              {tab === 'pending' && pendingGaps.length > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: 'var(--rc-rejected)',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '0 5px',
                    fontSize: 10,
                  }}
                >
                  {pendingGaps.length}
                </span>
              )}
              {tab === 'open' && openTasks.length > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  {openTasks.length}
                </span>
              )}
            </button>
          ))}
          {activeTab === 'pending' && pendingGaps.length > 0 && (
            <button
              className="rc-btn rc-btn-sm rc-btn-primary"
              onClick={promoteAll}
            >
              <i className="ti ti-plus" /> Promote all
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 0 8px' }}>
        {/* PENDING GAPS TAB */}
        {activeTab === 'pending' &&
          (pendingGaps.length === 0 ? (
            <div className="rc-empty" style={{ padding: 24 }}>
              <i className="ti ti-checks" />
              <div>No gaps from latest run — run an agent first.</div>
            </div>
          ) : (
            <div>
              {pendingGaps.map((gap, i) => {
                const colors =
                  SEVERITY_COLORS[gap.severity] ?? SEVERITY_COLORS.major
                const isPromoting = promoting.has(i)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--rc-divider)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: colors.bg,
                        color: colors.text,
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {gap.severity}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--rc-text-primary)',
                        }}
                      >
                        {gap.text}
                      </div>
                      {(gap.framework || gap.sectionRef) && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--rc-text-muted)',
                            marginTop: 3,
                          }}
                        >
                          {gap.framework}
                          {gap.sectionRef && ` · ${gap.sectionRef}`}
                        </div>
                      )}
                    </div>
                    <button
                      className="rc-btn rc-btn-sm"
                      onClick={() => promote(gap, i)}
                      disabled={isPromoting}
                      style={{ flexShrink: 0 }}
                    >
                      {isPromoting ? (
                        <i
                          className="ti ti-loader-2"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <>
                          <i className="ti ti-plus" /> Track
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}

        {/* OPEN/IN-PROGRESS TASKS TAB */}
        {activeTab === 'open' &&
          (loading ? (
            <div className="rc-empty" style={{ padding: 24 }}>
              <i
                className="ti ti-loader-2"
                style={{ animation: 'spin 1s linear infinite' }}
              />
              <div>Loading tasks...</div>
            </div>
          ) : openTasks.length === 0 ? (
            <div className="rc-empty" style={{ padding: 24 }}>
              <i className="ti ti-checks" />
              <div>No open remediation tasks.</div>
            </div>
          ) : (
            <div>
              {openTasks.map((task) => (
                <RemediationRow
                  key={task.id}
                  task={task}
                  onStatusChange={updateStatus}
                  onOwnerChange={updateOwner}
                  onDueDateChange={updateDueDate}
                  onDelete={remove}
                />
              ))}
            </div>
          ))}

        {/* RESOLVED TASKS TAB */}
        {activeTab === 'resolved' &&
          (resolvedTasks.length === 0 ? (
            <div className="rc-empty" style={{ padding: 24 }}>
              <i className="ti ti-archive" />
              <div>No resolved tasks yet.</div>
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>
              {resolvedTasks.map((task) => (
                <RemediationRow
                  key={task.id}
                  task={task}
                  onStatusChange={updateStatus}
                  onOwnerChange={updateOwner}
                  onDueDateChange={updateDueDate}
                  onDelete={remove}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Individual task row ───────────────────────────────────────────────────────

function RemediationRow({
  task,
  onStatusChange,
  onOwnerChange,
  onDueDateChange,
  onDelete,
}: {
  task: RemediationTask
  onStatusChange: (id: string, status: string) => void
  onOwnerChange: (id: string, name: string, initials: string) => void
  onDueDateChange: (id: string, date: string) => void
  onDelete: (id: string) => void
}) {
  const colors = SEVERITY_COLORS[task.severity] ?? SEVERITY_COLORS.major

  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--rc-divider)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Severity badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            background: colors.bg,
            color: colors.text,
            textTransform: 'uppercase',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {task.severity}
        </span>

        {/* Gap text + controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--rc-text-primary)',
              textDecoration:
                task.status === 'resolved' ? 'line-through' : 'none',
            }}
          >
            {task.gapText}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Agent source */}
            <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>
              <i className="ti ti-robot" style={{ marginRight: 3 }} />
              {task.agentName}
            </span>

            {/* Framework ref */}
            {task.sectionRef && (
              <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>
                {task.sectionRef}
              </span>
            )}

            {/* Status dropdown */}
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
              className="rc-input"
              style={{ fontSize: 11, padding: '1px 4px', height: 22, width: 'auto' }}
            >
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Owner dropdown */}
            <select
              value={task.ownerName}
              onChange={(e) => {
                const person = PEOPLE_OPTIONS.find(
                  (p) => p.name === e.target.value,
                )
                if (person)
                  onOwnerChange(task.id, person.name, person.initials)
              }}
              className="rc-input"
              style={{ fontSize: 11, padding: '1px 4px', height: 22, width: 'auto' }}
            >
              {PEOPLE_OPTIONS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Due date */}
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(e) => onDueDateChange(task.id, e.target.value)}
              className="rc-input"
              style={{ fontSize: 11, padding: '1px 4px', height: 22, width: 'auto' }}
            />

            {/* Delete */}
            <button
              className="rc-btn rc-btn-ghost rc-btn-sm"
              onClick={() => onDelete(task.id)}
              style={{ padding: '0 6px', marginLeft: 'auto' }}
              title="Remove task"
            >
              <i className="ti ti-trash" style={{ fontSize: 12 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
