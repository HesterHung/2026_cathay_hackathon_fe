import { useMemo, useState } from 'react'
import { formatCurrency, getOverviewQueues, recoveryCases } from './domain'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { ShipmentLinks } from './ShipmentLinks'

interface DisruptionAlertsPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  onOpenRecoverySolution: (caseId: string) => void
  onSelectShipment: (shipmentId: string) => void
  initialCaseId?: string
}

export function DisruptionAlertsPage({ onNavigate, onOpenRecoverySolution, onSelectShipment, initialCaseId }: DisruptionAlertsPageProps) {
  const confirmedCases = useMemo(() => {
    const activeIds = new Set(getOverviewQueues().recovery.map((item) => item.lifecycle.recoveryCaseId).filter((id): id is string => Boolean(id)))
    return recoveryCases.filter((item) => activeIds.has(item.id))
  }, [])
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId && confirmedCases.some((item) => item.id === initialCaseId) ? initialCaseId : '')
  const selectedCase = confirmedCases.find((item) => item.id === selectedCaseId)
  const affectedShipmentCount = new Set(confirmedCases.flatMap((item) => item.affectedShipmentIds)).size

  return <div className="app-shell">
    <WorkspaceSidebar active="Disruption Alerts" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> DISRUPTION ALERTS</div><span className="demo-label">WORKSPACE</span></header>
      <div className="page-heading"><div><h1>Disruption Alerts</h1><p className="subtitle">Highest-priority queue: confirmed disruptions requiring operator response.</p></div><span className="demo-label">PRIORITY 1</span></div>
      <section className="lifecycle-banner"><strong>Confirmed events only</strong><span>Forecast-only risks remain in Predicted Offload. Domino-offload candidates remain in Pending Pool.</span><small>Open the shared Recovery Solution to compare routing options and record a review.</small></section>
      <section className="plan-entry-summary">
        <div className={confirmedCases.length ? 'needs-review' : ''}><small>CONFIRMED DISRUPTIONS</small><strong>{confirmedCases.length}</strong></div>
        <div><small>AFFECTED SHIPMENTS</small><strong>{affectedShipmentCount}</strong></div>
        <div><small>WORKFLOW</small><strong>Operator review</strong></div>
      </section>
      <section className="workspace-intro plan-case-picker">
        <div><p className="eyebrow">PRIORITY 1 · DISRUPTION RESPONSE</p><h2>Select a confirmed alert</h2><p>Only operational events and authorized offload decisions appear in this queue.</p></div>
        <label>Confirmed alert<select value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}><option value="">Choose an alert</option>{confirmedCases.map((item) => <option key={item.id} value={item.id}>Flight {item.originalFlight} · {item.origin} → {item.destination}</option>)}</select></label>
      </section>
      {selectedCase ? <>
        <section className="workspace-intro recovery-case-intro selected-flight-card">
          <div><p className="eyebrow">CONFIRMED DISRUPTION · {selectedCase.id}</p><h2>Flight {selectedCase.originalFlight} · {selectedCase.origin} → {selectedCase.destination}</h2><p>{selectedCase.disruption}</p><small>Affected shipments: <ShipmentLinks ids={selectedCase.affectedShipmentIds} onSelect={onSelectShipment} /></small></div>
        </section>
        <section className="disruption-response-grid">
          <article><small>OFFLOAD REASON</small><strong>{selectedCase.reason}</strong></article>
          <article><small>CAPACITY CONSTRAINT</small><strong>{selectedCase.capacityConstraint}</strong></article>
          <article><small>DELIVERY COMMITMENT</small><strong>{selectedCase.deliveryCommitment}</strong></article>
          <article><small>BASELINE EXPECTED LOSS</small><strong>{formatCurrency(selectedCase.baselineExpectedLoss)}</strong></article>
        </section>
        <section className="pool-priority-note"><strong>Next step · shared routing</strong><span>Use the same loss-focused Recovery Solution available to predicted offload cases.</span><button className="primary-button" onClick={() => onOpenRecoverySolution(selectedCase.id)}>Open Recovery Solution →</button></section>
      </> : <div className="plan-selection-prompt">{confirmedCases.length ? 'Select an alert above to review its confirmed disruption and response options.' : 'No confirmed disruption alerts require review.'}</div>}
      <footer>All disruption and recovery records are simulated. Predictions do not enter this page until a confirmed operational event or authorized decision exists.</footer>
    </main>
  </div>
}
