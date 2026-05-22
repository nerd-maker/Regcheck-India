'use client'

import '../../styles/platform.css'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspaceStore'
import TopBar from '@/components/veeva/TopBar'
import LeftNav from '@/components/veeva/LeftNav'
import RightInspector from '@/components/veeva/RightInspector'
import WorkspaceRouter from '@/components/WorkspaceRouter'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { inspectorOpen } = useWorkspace()
  return (
    <div
      className="rc-shell"
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--rc-topbar-height) 1fr',
        gridTemplateColumns: `var(--rc-sidebar-width) 1fr ${inspectorOpen ? 'var(--rc-inspector-width)' : '0px'}`,
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        transition: 'grid-template-columns 200ms ease',
      }}
      data-testid="rc-shell"
    >
      <div style={{ gridColumn: '1 / -1' }}><TopBar/></div>
      <LeftNav/>
      <main className="rc-scroll" style={{ overflow: 'auto', background: 'var(--rc-surface-secondary)' }}>
        <WorkspaceRouter/>
        {children}
      </main>
      <RightInspector/>
    </div>
  )
}
