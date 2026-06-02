'use client'

import { useWorkspace } from '@/lib/workspaceStore'
import HomeView from './views/HomeView'
import SubmissionsView from './views/SubmissionsView'
import SubmissionDetailView from './views/SubmissionDetailView'
import ApplicationsView from './views/ApplicationsView'
import RegistrationsView from './views/RegistrationsView'
import DocumentsView from './views/DocumentsView'
import HACorrespondenceView from './views/HACorrespondenceView'
import AuditTrailView from './views/AuditTrailView'
import ReportsView from './views/ReportsView'
import AgentActionView from './views/AgentActionView'
import SettingsView from './views/SettingsView'

const AGENT_IDS = ['m1-anonymiser','m2-summariser','m3-completeness','m4-classifier','m5-inspection','m6-qa','m7-scheduley','m8-ichgcp','m9-crossdoc']

export default function WorkspaceRouter() {
  const { activeView } = useWorkspace()

  if (activeView === 'home')                return <HomeView/>
  if (activeView === 'submissions')         return <SubmissionsView/>
  if (activeView === 'submission-detail')   return <SubmissionDetailView/>
  if (activeView === 'applications')        return <ApplicationsView/>
  if (activeView === 'registrations')       return <RegistrationsView/>
  if (activeView === 'documents')           return <DocumentsView/>
  if (activeView === 'correspondence')      return <HACorrespondenceView/>
  if (activeView === 'audit-trail')         return <AuditTrailView/>
  if (activeView === 'reports')             return <ReportsView/>
  if (activeView === 'settings')            return <SettingsView section="settings"/>
  if (activeView === 'apikeys')             return <SettingsView section="apikeys"/>
  if (AGENT_IDS.includes(activeView))       return <AgentActionView agentId={activeView}/>

  return <HomeView/>
}
