import { useMemo, useState } from 'react'
import { evaluateRecoveryScenario, formatCurrency, formatKg, getOverviewQueues, recoveryCases, recoveryOptions, type RecoveryOption, type RecoveryScenario } from './domain'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { ShipmentLinks } from './ShipmentLinks'

interface RecoverySolutionPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  onReview: (option: RecoveryOption, scenario: RecoveryScenario) => void
  onSelectShipment: (shipmentId: string) => void
  initialCaseId?: string
  initialFlightId?: string
}

export function RecoverySolutionPage({ onNavigate, onReview, onSelectShipment, initialCaseId, initialFlightId }: RecoverySolutionPageProps) {
  const solutionCases = useMemo(() => {
    const queues = getOverviewQueues()
    return [
      ...queues.recovery.flatMap((item) => {
        const recoveryCase = recoveryCases.find((candidate) => candidate.id === item.lifecycle.recoveryCaseId)
        return recoveryCase ? [{ id: recoveryCase.id, flightId: item.lifecycle.flightId, shipmentIds: item.lifecycle.shipmentIds, lifecycle: item.lifecycle, forecast: item.forecast, recoveryCase, stage: 'confirmed' as const }] : []
      }),
      ...queues.preventive.flatMap((item) => {
        const recoveryCase = recoveryCases.find((candidate) => candidate.originalFlight === item.lifecycle.flightId)
        return recoveryCase ? [{ id: recoveryCase.id, flightId: item.lifecycle.flightId, shipmentIds: item.lifecycle.shipmentIds, lifecycle: item.lifecycle, forecast: item.forecast, recoveryCase, stage: 'predicted' as const }] : []
      }),
    ]
  }, [])
  const initialId = initialCaseId ?? solutionCases.find((item) => item.flightId === initialFlightId)?.id ?? ''
  const [caseId, setCaseId] = useState(initialId)
  const selectedCase = solutionCases.find((item) => item.id === caseId)
  const scenario: RecoveryScenario = selectedCase?.stage === 'predicted' ? 'preventive' : 'recover'
  const options = useMemo(() => selectedCase ? recoveryOptions.filter((option) => option.caseId === selectedCase.id && selectedCase.shipmentIds.includes(option.shipmentId)) : [], [selectedCase])
  const evaluations = useMemo(() => evaluateRecoveryScenario(scenario, options), [options, scenario])
  const recommended = evaluations.filter((item) => item.isFeasible).sort((a, b) => a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss)[0]
  const confirmedCount = solutionCases.filter((item) => item.stage === 'confirmed').length
  const predictedCount = solutionCases.filter((item) => item.stage === 'predicted').length

  return <div className="app-shell">
    <WorkspaceSidebar active="Recovery Solution" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> RECOVERY SOLUTION</div><span className="demo-label">WORKSPACE</span></header>
      <div className="page-heading"><div><h1>Recovery Solution</h1><p className="subtitle">One loss-focused routing workflow for predicted and confirmed offloads.</p></div><span className="demo-label">SIMULATED</span></div>
      <section className="lifecycle-banner"><strong>Shared routing solution</strong><span>Review alternative routes before an offload is confirmed or after a disruption is confirmed. The case stage stays visible; the routing and loss comparison are shared.</span><small>A review decision does not book, allocate, or reassign cargo.</small></section>
      <section className="plan-entry-summary">
        <div><small>PREDICTED CASES</small><strong>{predictedCount}</strong></div>
        <div><small>CONFIRMED DISRUPTIONS</small><strong>{confirmedCount}</strong></div>
        <div><small>OBJECTIVE</small><strong>Reduce modeled loss</strong></div>
      </section>
      <section className="workspace-intro plan-case-picker">
        <div><p className="eyebrow">SELECT AN OFFLOAD CASE</p><h2>Build or review a routing solution</h2><p>The same comparison supports forecast-risk and confirmed-disruption cases.</p></div>
        <label>Offload case<select value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Choose a case</option>{solutionCases.map((item) => <option key={`${item.stage}-${item.id}`} value={item.id}>{item.stage === 'confirmed' ? 'Confirmed' : 'Predicted'} · Flight {item.flightId} · {item.recoveryCase.origin} → {item.recoveryCase.destination}</option>)}</select></label>
      </section>
      {selectedCase ? <>
        <section className="workspace-intro recovery-case-intro selected-flight-card">
          <div><p className="eyebrow">{selectedCase.stage === 'confirmed' ? 'CONFIRMED DISRUPTION' : 'PREDICTED OFFLOAD'} · {selectedCase.id}</p><h2>Flight {selectedCase.flightId} · {selectedCase.recoveryCase.origin} → {selectedCase.recoveryCase.destination}</h2><p>{selectedCase.recoveryCase.disruption}</p><small>Affected cargo: <ShipmentLinks ids={selectedCase.shipmentIds} onSelect={onSelectShipment} /></small></div>
        </section>
        <section className="disruption-response-grid">
          <article><small>CASE STATUS</small><strong>{selectedCase.lifecycle.statusLabel}</strong></article>
          <article><small>OFFLOAD REASON</small><strong>{selectedCase.recoveryCase.reason}</strong></article>
          <article><small>DELIVERY COMMITMENT</small><strong>{selectedCase.recoveryCase.deliveryCommitment}</strong></article>
          <article><small>BASELINE EXPECTED LOSS</small><strong>{formatCurrency(selectedCase.recoveryCase.baselineExpectedLoss)}</strong></article>
        </section>
        {selectedCase.stage === 'predicted' && <section className="analytics-note"><strong>Forecast stage · not a confirmed offload</strong><span>Compare candidate routes now to reduce potential loss. This review does not change the predicted status.</span><small>{selectedCase.forecast ? `${Math.round(selectedCase.forecast.forecastOffloadProbability * 100)}% demo flight risk · ${formatKg(selectedCase.forecast.forecastCapacityShortfall)} forecast shortfall · ${selectedCase.forecast.forecastConfidence}% confidence` : 'Forecast evidence unavailable.'}</small></section>}
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">LOSS-FOCUSED ROUTING · {selectedCase.stage === 'confirmed' ? 'RECOVERY' : 'PRE-OFFLOAD REVIEW'}</p><h2>Compare routing solutions</h2><p>{evaluations.length} alternatives ranked by feasibility and modeled total expected loss. Confirm capacity, handling, and service constraints before action.</p></div><span className="demo-label">SIMULATED</span></div>
          {evaluations.length ? <div className="table-wrap"><table className="recovery-comparison-table"><thead><tr><th>OPTION</th><th>ALTERNATIVE ROUTE</th><th>USABLE CAPACITY</th><th>ARRIVAL / DELAY</th><th>RECOVERY COST</th><th>TOTAL MODELED LOSS</th><th>STATUS</th><th /></tr></thead><tbody>
            {evaluations.map((evaluation) => {
              const isRecommended = recommended?.option.id === evaluation.option.id
              return <tr key={evaluation.option.id} className={isRecommended ? 'recommended-row' : ''}>
                <td><strong>{evaluation.option.id}</strong>{isRecommended && <small className="recommendation-label">LOWEST-LOSS FEASIBLE</small>}</td>
                <td><strong>{evaluation.option.alternative}</strong><small>{evaluation.option.alternativeFlight}</small></td>
                <td>{formatKg(evaluation.option.usableCapacityKg)}<small>{evaluation.option.capacityStatus}</small></td>
                <td>{evaluation.option.expectedArrival}<small>{evaluation.option.delayHours}h delay · {evaluation.deliveryCommitmentFeasible ? 'On time' : 'Deadline risk'}</small></td>
                <td>{formatCurrency(evaluation.costBreakdown.recoveryAndHandlingCost)}</td>
                <td><strong>{formatCurrency(evaluation.costBreakdown.totalExpectedLoss)}</strong><small>Includes cargo, service, and network impacts</small></td>
                <td><span className={`status-pill ${evaluation.isFeasible ? 'status-good' : evaluation.missingData.length ? 'status-pending' : 'status-bad'}`}>{evaluation.isFeasible ? 'Feasible' : evaluation.missingData.length ? 'Check data' : 'Infeasible'}</span></td>
                <td><button className="text-button" onClick={() => onReview(evaluation.option, scenario)}>Record review →</button></td>
              </tr>
            })}
          </tbody></table></div> : <div className="empty-state"><strong>No routing candidates available</strong><span>There are no options linked to this case in the demo data.</span></div>}
        </section>
        <section className="analytics-note"><strong>How to use this solution</strong><span>Compare feasible alternatives and modeled loss. A review records operator intent only; operational systems must confirm any route or ULD movement.</span><small>Recommendation is a lowest-loss feasible candidate in this demo, not a proven global optimum.</small></section>
      </> : <div className="plan-selection-prompt">{solutionCases.length ? 'Select a predicted or confirmed case above to compare routing solutions.' : 'No cases are currently available.'}</div>}
      <footer>All cases, routing options, cost estimates, and feasibility results are synthetic. No live booking or cargo reassignment is executed.</footer>
    </main>
  </div>
}
