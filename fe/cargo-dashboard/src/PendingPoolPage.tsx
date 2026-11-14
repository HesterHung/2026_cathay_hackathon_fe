import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { PendingPoolApiWorkspace } from './PendingPoolApiWorkspace'

interface PendingPoolPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialFlightId?: string
  onOpenRecovery: (workItemId: string, flightId: string) => void
}

export function PendingPoolPage({ onNavigate, initialFlightId, onOpenRecovery }: PendingPoolPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Pending Pool" onNavigate={onNavigate} />
    <main className="main-content shipment-page pending-pool-page">
      <header className="topbar"><div className="crumb">Cathay Router <span>/</span> Pending Pool</div></header>

      <div className="page-heading">
        <div><h1>Pending Pool</h1></div>
      </div>

      {initialFlightId && <section className="pool-target-context"><strong>Opened from {initialFlightId}</strong><span>Compare pool candidates with this higher-priority flight, then return to its recovery review.</span></section>}
      <section className="lifecycle-banner"><strong>Review and compatibility only</strong><span>A priority hold does not reserve capacity. Candidate evaluation and no-show review do not assign cargo.</span></section>
      <PendingPoolApiWorkspace initialFlightId={initialFlightId} onOpenRecovery={onOpenRecovery} />
      <footer>Pending-pool records and review decisions come from the recovery-solutions API. Allocation remains a separate authorized workflow.</footer>
    </main>
  </div>
}
