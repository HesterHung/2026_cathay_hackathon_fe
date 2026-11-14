import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { PredictedOffloadApiWorkspace } from './PredictedOffloadApiWorkspace'

interface PredictedOffloadPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialFlightId?: string
  onOpenRecovery: (workItemId: string, flightId: string) => void
}

export function PredictedOffloadPage({ onNavigate, initialFlightId, onOpenRecovery }: PredictedOffloadPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Predicted Offload" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">Cathay Router <span>/</span> Predicted Offload</div></header>
      <section className="lifecycle-banner"><strong>Forecast is not a confirmed offload</strong><span>Route reviews do not confirm an offload or change the work item out of PREDICTED_OFFLOAD.</span><small>When active disruption work blocks this queue, keep records visible and use the API workflow message to understand the gate.</small></section>
      <PredictedOffloadApiWorkspace initialFlightId={initialFlightId} onOpenRecovery={onOpenRecovery} />
      <footer>This page uses recovery-solutions API records only. An approved review is not a booking, allocation, capacity reservation, or offload confirmation.</footer>
    </main>
  </div>
}
