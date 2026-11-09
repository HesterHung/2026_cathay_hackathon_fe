import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { PendingPoolApiWorkspace } from './PendingPoolApiWorkspace'

interface PendingPoolPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialFlightId?: string
}

export function PendingPoolPage({ onNavigate, initialFlightId }: PendingPoolPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Pending Pool" onNavigate={onNavigate} />
    <main className="main-content shipment-page pending-pool-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> PENDING POOL</div><span className="demo-label">RECOVERY API</span></header>

      <div className="page-heading">
        <div><p className="eyebrow">PRIORITY 3 · BACKUP INVENTORY</p><h1>Pending Pool</h1><p className="subtitle">Inspect domino-offloaded ULDs and evaluate them against active priority demand.</p></div>
        <span className="demo-label">REVIEW ONLY</span>
      </div>

      <section className="pool-priority-flow" aria-label="Priority order">
        <div><span>1</span><strong>Disruption Alerts</strong><small>Confirmed offloads</small></div><i aria-hidden="true">›</i>
        <div><span>2</span><strong>Predicted Offload</strong><small>Forecast at risk</small></div><i aria-hidden="true">›</i>
        <div className="current"><span>3</span><strong>Pending Pool</strong><small>Domino offloads</small></div>
      </section>

      {initialFlightId && <section className="pool-target-context"><strong>Opened from {initialFlightId}</strong><span>Compare pool candidates with this higher-priority flight, then return to its recovery review.</span></section>}
      <section className="lifecycle-banner"><strong>Review and compatibility only</strong><span>A priority hold does not reserve capacity. Candidate evaluation and no-show review do not assign cargo.</span></section>
      <PendingPoolApiWorkspace initialFlightId={initialFlightId} />
      <footer>Pending-pool records and review decisions come from the recovery-solutions API. Allocation remains a separate authorized workflow.</footer>
    </main>
  </div>
}
