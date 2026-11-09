import { useMemo, useState } from 'react'
import { formatCurrency, formatKg, getOverviewQueues, shipments } from './domain'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { ShipmentLinks } from './ShipmentLinks'

interface PredictedOffloadPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  onOpenPendingPool: (flightId: string) => void
  onOpenRecoverySolution: (flightId: string) => void
  onSelectShipment: (shipmentId: string) => void
  initialFlightId?: string
}

export function PredictedOffloadPage({ onNavigate, onOpenPendingPool, onOpenRecoverySolution, onSelectShipment, initialFlightId }: PredictedOffloadPageProps) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(initialFlightId ?? null)
  const predictedCases = useMemo(() => getOverviewQueues().preventive.flatMap((item) => {
    if (!item.forecast) return []
    return [{ lifecycle: item.lifecycle, forecast: item.forecast }]
  }).sort((a, b) => b.forecast.forecastOffloadProbability - a.forecast.forecastOffloadProbability), [])

  return <div className="app-shell">
    <WorkspaceSidebar active="Predicted Offload" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> PREDICTED OFFLOAD</div><span className="demo-label">SIMULATED</span></header>
      <div className="page-heading"><div><h1>Predicted Offload</h1><p className="subtitle">Triage forecast-only cargo risks after confirmed disruptions and before the pending pool.</p></div><span className="demo-label">PRIORITY 2</span></div>
      <section className="lifecycle-banner"><strong>Forecast is not a confirmed offload</strong><span>Review the predicted cargo, check pool alternatives, or continue with the forecast evidence.</span><small>No booking, allocation, or offload confirmation is made from this page.</small></section>
      <section className="plan-entry-summary">
        <div className={predictedCases.length ? 'needs-review' : ''}><small>FLIGHTS TO REVIEW</small><strong>{predictedCases.length}</strong></div>
        <div><small>AFFECTED SHIPMENTS</small><strong>{new Set(predictedCases.flatMap((item) => item.lifecycle.shipmentIds)).size}</strong></div>
        <div><small>QUEUE SCOPE</small><strong>Forecast only</strong></div>
      </section>
      <section className="pool-priority-note"><strong>Priority order</strong><span>Disruption Alerts → Predicted Offload → Pending Pool. Scarce pool capacity should be considered for priority 1 and 2 demand first.</span><button className="text-button" onClick={() => onNavigate('Disruption Alerts')}>View disruption alerts →</button></section>
      {predictedCases.length ? <section className="predicted-offload-list" aria-label="Predicted offload cases">
        {predictedCases.map(({ lifecycle, forecast }) => {
          const affectedShipments = shipments.filter((shipment) => lifecycle.shipmentIds.includes(shipment.id))
          const isSelected = selectedFlightId === forecast.flightId
          return <article className={`predicted-offload-card ${isSelected ? 'selected' : ''}`} key={lifecycle.id}>
            <header><div><p className="eyebrow">PREDICTED · NOT CONFIRMED</p><h2>{forecast.flightId} <span>{forecast.route}</span></h2><p>{forecast.departure} · {forecast.aircraftType}</p></div><span className="status-pill status-pending">{lifecycle.statusLabel}</span></header>
            <div className="queue-metrics">
              <span><small>FLIGHT OFFLOAD RISK</small><b>{Math.round(forecast.forecastOffloadProbability * 100)}%</b></span>
              <span><small>WEIGHT SHORTFALL</small><b>{formatKg(forecast.forecastCapacityShortfall)}</b></span>
              <span><small>SHIPMENTS AFFECTED</small><b>{lifecycle.shipmentIds.length}</b></span>
              <span><small>VALUE AT RISK</small><b>{formatCurrency(forecast.valueAtRisk)}</b></span>
            </div>
            <p className="queue-drivers">{forecast.riskDrivers.join(' ')} Weather confidence {forecast.forecastConfidence}% · simulated.</p>
            <div className="predicted-offload-actions">
              <button className="outline-button" onClick={() => onOpenPendingPool(forecast.flightId)}>Check Pending Pool</button>
              <button className="primary-button" onClick={() => setSelectedFlightId(isSelected ? null : forecast.flightId)}>{isSelected ? 'Close predicted cargo' : 'Continue with predicted cargo'}</button>
            </div>
            {isSelected && <section className="predicted-cargo-review" aria-label={`Predicted cargo review for ${forecast.flightId}`}>
              <div><p className="eyebrow">PREDICTED LOAD REVIEW</p><h3>Review affected shipment(s)</h3><p>This forecast has not created a confirmed offload case. Verify shipment and unitization details before any operational action.</p></div>
              <div className="predicted-cargo-details">
                <span><small>FORECAST CARGO CAPACITY</small><b>{formatKg(forecast.forecastCargoCapacity)}</b></span>
                <span><small>BOOKED WEIGHT</small><b>{formatKg(forecast.forecastBookedWeight)}</b></span>
                <span><small>SHIPMENT LINKS</small><b>{affectedShipments.length}</b></span>
              </div>
              <p className="shipment-link-row"><ShipmentLinks ids={lifecycle.shipmentIds} onSelect={onSelectShipment} /></p>
              <button className="primary-button" onClick={() => onOpenRecoverySolution(forecast.flightId)}>Open Recovery Solution →</button>
            </section>}
          </article>
        })}
      </section> : <div className="empty-state"><strong>No predicted offloads need review</strong><span>Forecast-only cases will appear here when the lifecycle queue identifies them.</span></div>}
      <footer>Forecast records and cargo impacts are synthetic. ULD assignments and available alternatives require operational confirmation.</footer>
    </main>
  </div>
}
