import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { DisruptionApiWorkspace } from './DisruptionApiWorkspace'

interface DisruptionAlertsPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
}

export function DisruptionAlertsPage({ onNavigate }: DisruptionAlertsPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Disruption Alerts" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">Cathay Router <span>/</span> Disruption Alerts</div><span className="demo-label">Recovery API</span></header>
      <div className="page-heading">
        <div><p className="eyebrow">Priority 1 · Confirmed offloads</p><h1>Disruption Alerts</h1><p className="subtitle">Review confirmed offload evidence and route options for each ULD under its MAWB.</p></div>
      </div>
      <section className="lifecycle-banner"><strong>Confirmed events only</strong><span>Only API work items classified as DISRUPTION appear here. A saved route review does not confirm an offload or execute the route.</span><small>Resolve disruption work before advancing lower-priority queues, as directed by the API workflow control.</small></section>
      <DisruptionApiWorkspace />
      <footer>Disruption Alerts displays recovery-solutions API data only. API errors and empty responses remain visible; synthetic fixture cases are not substituted into this operational queue.</footer>
    </main>
  </div>
}
