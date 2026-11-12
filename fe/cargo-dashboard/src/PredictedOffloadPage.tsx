import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { PredictedOffloadApiWorkspace } from './PredictedOffloadApiWorkspace'

interface PredictedOffloadPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialFlightId?: string
}

export function PredictedOffloadPage({ onNavigate, initialFlightId }: PredictedOffloadPageProps) {
  return <div className="app-shell">
    <WorkspaceSidebar active="Predicted Offload" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">Cathay Router <span>/</span> Predicted Offload</div><span className="demo-label">Recovery API</span></header>
      <div className="page-heading"><div><p className="eyebrow">Priority 2 · Forecast only</p><h1>Predicted Offload</h1><p className="subtitle">Triage flight forecasts and review each ULD separately.</p></div></div>
      <section className="lifecycle-banner"><strong>Forecast is not a confirmed offload</strong><span>Route reviews do not confirm an offload or change the work item out of PREDICTED_OFFLOAD.</span><small>When active disruption work blocks this queue, keep records visible and use the API workflow message to understand the gate.</small></section>
      <PredictedOffloadApiWorkspace initialFlightId={initialFlightId} />
      <footer>This page uses recovery-solutions API records only. An approved review is not a booking, allocation, capacity reservation, or offload confirmation.</footer>
    </main>
  </div>
}
