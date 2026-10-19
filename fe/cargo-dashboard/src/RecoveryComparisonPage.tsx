import { useMemo, useState } from 'react'
import { evaluateRecoveryScenario, formatCurrency, formatKg, getOverviewQueues, recoveryCases, recoveryOptions, type RecoveryOption, type RecoveryScenario } from './domain'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { ShipmentLinks } from './ShipmentLinks'

interface RecoveryComparisonPageProps {
  onNavigate: (item: 'Overview' | 'Predictions' | 'Prevention Plan' | 'Shipments' | 'Recovery Plans' | 'Analytics' | 'Settings' | 'Unknown') => void
  onSelect: (option: RecoveryOption, scenario: RecoveryScenario) => void
  onSelectShipment: (shipmentId: string) => void
  initialCaseId?: string
}

type SortKey = 'loss' | 'arrival' | 'cost' | 'network'

const scenarioLabels: Record<'no-intervention' | 'recover', string> = {
  'no-intervention': 'No intervention',
  recover: 'Offload and recover',
}

const money = (value: number) => formatCurrency(value)



export function RecoveryComparisonPage({ onNavigate, onSelect, onSelectShipment, initialCaseId }: RecoveryComparisonPageProps) {
  const activeRecoveryCases = useMemo(() => {
    const activeIds = new Set(getOverviewQueues().recovery.map((item) => item.lifecycle.recoveryCaseId).filter((id): id is string => Boolean(id)))
    return recoveryCases.filter((item) => activeIds.has(item.id))
  }, [])
  const [caseId, setCaseId] = useState(initialCaseId && activeRecoveryCases.some((item) => item.id === initialCaseId) ? initialCaseId : '')
  const [scenario, setScenario] = useState<'no-intervention' | 'recover'>('recover')
  const [sort, setSort] = useState<SortKey>('loss')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const recoveryCase = activeRecoveryCases.find((item) => item.id === caseId)
  const caseOptions = useMemo(() => recoveryCase ? recoveryOptions.filter((option) => option.caseId === recoveryCase.id && recoveryCase.affectedShipmentIds.includes(option.shipmentId)) : [], [recoveryCase])
  const evaluations = useMemo(() => evaluateRecoveryScenario(scenario, caseOptions), [caseOptions, scenario])
  const displayedEvaluations = useMemo(() => [...evaluations].sort((a, b) => {
      if (sort === 'loss') return a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss
      if (sort === 'cost') return a.costBreakdown.recoveryAndHandlingCost - b.costBreakdown.recoveryAndHandlingCost
      if (sort === 'network') return a.costBreakdown.downstreamNetworkImpact - b.costBreakdown.downstreamNetworkImpact
      return a.option.expectedArrival.localeCompare(b.option.expectedArrival)
    }), [evaluations, sort])
  const recommended = evaluations.filter((item) => item.isFeasible).sort((a, b) => a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss)[0]
  const selected = evaluations.find((item) => item.option.id === selectedId) ?? recommended ?? evaluations[0]
  const nextBest = recommended ? evaluations.filter((item) => item.isFeasible && item.option.id !== recommended.option.id).sort((a, b) => a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss)[0] : undefined
  const scenarioDescription = scenario === 'no-intervention' ? 'Original disruption remains active; no alternative capacity is reserved.' : 'Confirmed offload alternatives are evaluated under current capacity, fuel, weather, and delivery commitments.'

  return <div className="app-shell"><WorkspaceSidebar active="Recovery Plans" onNavigate={onNavigate} /><main className="main-content shipment-page"><header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> RECOVERY PLANS</div><span className="demo-label">WORKSPACE</span></header><div className="page-heading"><div><h1>Recovery Plan Comparison</h1><p className="subtitle">Compare options for confirmed offloads.</p></div><span className="demo-label">SIMULATED</span></div><section className="plan-entry-summary"><div className={activeRecoveryCases.length ? 'needs-review' : ''}><small>CASES TO REVIEW</small><strong>{activeRecoveryCases.length}</strong>{activeRecoveryCases.length > 0 && <span className="review-needed-badge">Review needed</span>}</div><div><small>AFFECTED SHIPMENTS</small><strong>{new Set(activeRecoveryCases.flatMap((item) => item.affectedShipmentIds)).size}</strong></div><div><small>WORKFLOW</small><strong>Confirmed events</strong></div></section><section className="workspace-intro plan-case-picker"><div><p className="eyebrow">START WITH A CASE</p><h2>Select a recovery case</h2><p>Choose a case to compare recovery options.</p></div><label>Recovery case<select value={caseId} onChange={(event) => { setCaseId(event.target.value); setSelectedId(null) }}><option value="">Choose a case</option>{activeRecoveryCases.map((item) => <option key={item.id} value={item.id}>Flight {item.originalFlight} · {item.origin} → {item.destination}</option>)}</select></label></section>{recoveryCase ? <><section className="workspace-intro recovery-case-intro selected-flight-card"><div><p className="eyebrow">RECOVERY CASE · {recoveryCase?.id}</p><h2>Flight {recoveryCase?.originalFlight} · {recoveryCase?.origin} → {recoveryCase?.destination}</h2><p>Delivery deadline: {recoveryCase?.deliveryCommitment}</p><small>Affected shipments: <ShipmentLinks ids={recoveryCase?.affectedShipmentIds ?? []} onSelect={onSelectShipment} /></small></div></section><div className="scenario-tabs"><span>Decision scenario</span>{(Object.entries(scenarioLabels) as [RecoveryScenario, string][]).map(([key, label]) => <button key={key} className={scenario === key ? 'selected' : ''} onClick={() => { setScenario(key as 'no-intervention' | 'recover'); setSelectedId(null) }}>{label}</button>)}</div><section className="analytics-note"><strong>{scenarioLabels[scenario]} assumptions</strong><span>{scenarioDescription}</span><small>Demo estimates. Confirm capacity, connections, fuel, weather, and handling before approval.</small></section><section className="panel"><div className="panel-heading"><div><h2>Compare Recovery Options</h2><p>{caseOptions.length} alternatives for {recoveryCase?.id}; all options below use the same scenario and loss definition.</p></div><label className="comparison-sort">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="loss">Lowest expected loss</option><option value="arrival">Earliest arrival</option><option value="cost">Lowest recovery cost</option><option value="network">Lowest network impact</option></select></label></div><div className="table-wrap"><table className="recovery-comparison-table"><thead><tr><th>OPTION</th><th>ROUTE</th><th>CAPACITY</th><th>FUEL / WX</th><th>ARRIVAL</th><th>COSTS</th><th>TOTAL LOSS</th><th>STATUS</th></tr></thead><tbody>{displayedEvaluations.map((evaluation) => { const option = evaluation.option; const isRecommended = recommended?.option.id === option.id; return <tr key={option.id} className={`${isRecommended ? 'recommended-row' : ''} ${selected?.option.id === option.id ? 'selected-row' : ''}`} onClick={() => onSelect(option, scenario)}><td><strong>{option.id}</strong>{isRecommended && <small className="recommendation-label">RECOMMENDED</small>}</td><td><strong>{option.original}</strong><small>{option.alternative}</small></td><td><b className={`status-pill ${evaluation.isFeasible ? 'status-good' : evaluation.missingData.length ? 'status-pending' : 'status-bad'}`}>{evaluation.isFeasible ? 'Feasible' : evaluation.missingData.length ? 'Check data' : 'Infeasible'}</b><small>{formatKg(option.usableCapacityKg)} usable</small></td><td><b title={option.fuelConstraint} className={`status-pill ${option.fuelConstraint.includes('No additional') || option.fuelConstraint.toLowerCase().includes('unchanged') ? 'status-good' : option.fuelConstraint.toLowerCase().includes('pending') || option.fuelConstraint.toLowerCase().includes('not yet confirmed') ? 'status-pending' : 'status-caution'}`}>{option.fuelConstraint.includes('No additional') || option.fuelConstraint.toLowerCase().includes('unchanged') ? 'Fuel OK' : option.fuelConstraint.toLowerCase().includes('pending') || option.fuelConstraint.toLowerCase().includes('not yet confirmed') ? 'Fuel pending' : option.fuelConstraint.toLowerCase().includes('reduced') ? 'Buffer reduced' : 'Fuel check'}</b><small title={option.weatherExposure}>{option.weatherExposure}</small></td><td><b>{option.expectedArrival}</b><small>+{option.delayHours}h | {evaluation.deliveryCommitmentFeasible ? 'On time' : 'Deadline risk'}</small></td><td>See in review</td><td><strong>{money(evaluation.costBreakdown.totalExpectedLoss)}</strong></td><td><small>{evaluation.optimizationStatus === 'BEST_FEASIBLE_FOUND' ? 'Best' : evaluation.optimizationStatus === 'HEURISTIC_SUGGESTION' ? 'Suggested' : evaluation.missingData.length ? 'Check data' : 'Not feasible'}</small></td></tr> })}</tbody></table></div></section><footer>All candidates, costs, constraints, recommendations and decisions are fictional simulated data. No booking or reassignment is executed.</footer></> : <div className="plan-selection-prompt">{activeRecoveryCases.length ? 'Select a recovery case above to view recommendations.' : 'No active recovery cases.'}</div>}</main></div>
}
