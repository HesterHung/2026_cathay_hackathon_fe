import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { DisruptionApiWorkspace } from './DisruptionApiWorkspace'

interface DisruptionAlertsPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  onOpenRecovery: (workItemId: string, flightId: string) => void
}

export function DisruptionAlertsPage({ onNavigate, onOpenRecovery }: DisruptionAlertsPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Disruption Alerts" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">Cathay Router <span>/</span> Disruption Alerts</div></header>
      <section className="lifecycle-banner"><strong>Confirmed events only</strong><span>Only API work items classified as DISRUPTION appear here. A saved route review does not confirm an offload or execute the route.</span><small>Resolve disruption work before advancing lower-priority queues, as directed by the API workflow control.</small></section>
      <DisruptionApiWorkspace onOpenRecovery={onOpenRecovery} />
      <footer>Disruption Alerts displays recovery-solutions API data only. API errors and empty responses remain visible; synthetic fixture cases are not substituted into this operational queue.</footer>
    </main>
  </div>
}
