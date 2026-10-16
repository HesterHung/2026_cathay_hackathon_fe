import { useMemo, useState } from 'react'
import { evaluateRecoveryScenario, formatCurrency, formatKg, getOverviewQueues, recoveryCases, recoveryOptions, type RecoveryOption } from './domain'
import { WorkspaceSidebar } from './WorkspaceSidebar'

type NavItem = 'Overview' | 'Predictions' | 'Prevention Plan' | 'Shipments' | 'Recovery Plans' | 'Analytics' | 'Settings' | 'Unknown'

interface PreventionPlanPageProps {
  onNavigate: (item: NavItem) => void
  onReview: (option: RecoveryOption) => void
  initialFlightId?: string
}

export function PreventionPlanPage({ onNavigate, onReview, initialFlightId }: PreventionPlanPageProps) {
  const preventiveCases = useMemo(() => getOverviewQueues().preventive.flatMap((item) => {
    const recoveryCase = recoveryCases.find((candidate) => candidate.originalFlight === item.lifecycle.flightId)
    return recoveryCase ? [{ flightId: item.lifecycle.flightId, shipmentIds: item.lifecycle.shipmentIds, recoveryCase }] : []
  }), [])
  const [flightId, setFlightId] = useState(initialFlightId && preventiveCases.some((item) => item.flightId === initialFlightId) ? initialFlightId : preventiveCases[0]?.flightId ?? '')
  const selectedCase = preventiveCases.find((item) => item.flightId === flightId)
  const caseOptions = recoveryOptions.filter((option) => option.caseId === selectedCase?.recoveryCase.id)
  const evaluations = useMemo(() => evaluateRecoveryScenario('preventive', caseOptions), [caseOptions])

  return <div className="app-shell"><WorkspaceSidebar active="Prevention Plan" onNavigate={onNavigate} /><main className="main-content shipment-page"><header className="topbar"><div className="crumb">CATHAY ROUNTER <span>/</span> PREVENTION PLAN</div><span className="demo-label">SIMULATED</span></header><div className="page-heading"><div><p className="eyebrow">P1 · UNCONFIRMED OFFLOAD RISK · DEMO DATA</p><h1>Prevention Plan</h1><p className="subtitle">Review early options for at-risk flights before any offload is confirmed.</p></div><span className="demo-label">SIMULATED</span></div>
    <section className="lifecycle-banner"><strong>Prevention only</strong><span>This workspace covers predicted risks that are still unconfirmed. Confirmed offloads belong in Recovery Plans.</span><small>Options, capacity, costs, and expected benefits are simulated decision support; no allocation is committed here.</small></section>
    {preventiveCases.length ? <><section className="workspace-intro recovery-case-intro"><div><p className="eyebrow">UNCONFIRMED RISK</p><h2>{selectedCase?.flightId} · {selectedCase?.recoveryCase.origin} → {selectedCase?.recoveryCase.destination}</h2><p>{selectedCase?.recoveryCase.reason} · {selectedCase?.shipmentIds.length} affected shipment{selectedCase?.shipmentIds.length === 1 ? '' : 's'}.</p><small>{selectedCase?.recoveryCase.capacityConstraint}</small></div><label>Select flight<select value={flightId} onChange={(event) => setFlightId(event.target.value)}>{preventiveCases.map((item) => <option key={item.flightId} value={item.flightId}>{item.flightId} · {item.recoveryCase.origin} → {item.recoveryCase.destination}</option>)}</select></label></section>
    <section className="panel"><div className="panel-heading"><div><h2>Preventive options</h2><p>{evaluations.length} modeled options for {selectedCase?.flightId}; feasible candidates are listed first.</p></div><span className="demo-label">SIMULATED</span></div>{evaluations.length ? <div className="table-wrap"><table><thead><tr><th>OPTION</th><th>ALTERNATIVE</th><th>FEASIBILITY</th><th>USABLE CAPACITY</th><th>ARRIVAL / DELAY</th><th>RECOVERY COST</th><th>MODELED LOSS</th><th /></tr></thead><tbody>{evaluations.map((evaluation) => <tr key={evaluation.option.id}><td><strong>{evaluation.option.id}</strong><small>{evaluation.isFeasible ? evaluation.optimizationStatus.replaceAll('_', ' ') : 'Not currently feasible'}</small></td><td>{evaluation.option.alternative}</td><td>{evaluation.isFeasible ? 'Feasible' : evaluation.option.capacityStatus}</td><td>{formatKg(evaluation.option.usableCapacityKg)}</td><td>{evaluation.option.expectedArrival}<small>{evaluation.option.delayHours}h delay</small></td><td>{formatCurrency(evaluation.costBreakdown.recoveryAndHandlingCost)}</td><td><strong>{formatCurrency(evaluation.costBreakdown.totalExpectedLoss)}</strong><small>Customer and delay impacts included</small></td><td><button className="row-action" onClick={() => onReview(evaluation.option)} aria-label={`Review preventive option ${evaluation.option.id}`}>→</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No preventive options available</strong><span>There are no candidate options for this unconfirmed risk.</span></div>}</section><div className="analytics-note"><strong>How to use this plan</strong><span>Compare feasible alternatives by modeled loss, delay, and customer impact. Confirm the operational details before making any real allocation decision.</span><small>Heuristic suggestions are not solver-proven optimal plans.</small></div></> : <div className="empty-state"><strong>No unconfirmed prevention cases</strong><span>Current forecast risks are either clear or have moved to confirmed recovery.</span></div>}
    <footer>Prevention plans address unconfirmed risk. Once an offload is confirmed, continue in Recovery Plans.</footer></main></div>
}
