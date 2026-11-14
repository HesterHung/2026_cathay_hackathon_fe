import { useEffect, useState } from 'react'
import { getRecoveryOptions, getRecoverySolution, type RecoveryDetail, type RecoveryOption, type RecoveryOptionsResponse } from './recoveryApi'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { RecoveryAgentRun } from './RecoveryAgentRun'
import { Check } from 'lucide-react'

interface RecoverySolutionPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialWorkItemId?: string
  initialFlightId?: string
}

interface RecoverySolutionData {
  detail: RecoveryDetail
  options: RecoveryOption[]
  currency: string
}

const demoWorkflowControl: RecoveryDetail['workflowControl'] = {
  activePriority: null,
  canWorkDisruptions: true,
  canWorkPredictions: true,
  canReviewPool: true,
  allowedActionsByType: { DISRUPTION: [], PREDICTED_OFFLOAD: [], PENDING_POOL: [] },
  blockingWorkItemIds: [],
  message: 'Demo record. No decision will be sent to the API.',
}

function makeDemoOption(input: {
  id: string; route: string; flightId: string; capacity: number; arrival: string; delay: number; feasibility: string; percent: number; loss: number; currency: string; network: string
}): RecoveryOption {
  const [from, to] = input.route.split(' → ')
  const breakdown = { cargoCustomerImpact: input.loss * .55, cathayContributionImpact: input.loss * .15, recoveryAndHandlingCost: input.loss * .1, delayAndServiceImpact: input.loss * .15, downstreamNetworkImpact: input.loss * .05, totalModeledExpectedLoss: input.loss, currency: input.currency }
  return { optionId: input.id, optionType: 'reroute', recoveryLegs: [{ from, to, operatingFlightId: input.flightId }], feasibilityStatus: input.feasibility as RecoveryOption['feasibilityStatus'], feasibilityPercentage: input.percent, usableCapacityKg: input.capacity, capacityStatus: 'Capacity Confirmation Pending', fuelConstraint: 'Fuel plan requires carrier confirmation', weatherExposure: 'Arrival weather may affect handling', expectedArrival: input.arrival, expectedDelayMinutes: input.delay * 60, recoveryHandlingCost: breakdown.recoveryAndHandlingCost, totalModeledExpectedLoss: input.loss, costBreakdown: breakdown, missingData: ['Live capacity confirmation', 'Station handling confirmation'], networkImpact: input.network }
}

function buildDemoData(workItemId: string, flightId: string): RecoverySolutionData {
  const isPool = workItemId.includes('PENDING_POOL')
  const isPredicted = workItemId.includes('PREDICTED_OFFLOAD')
  const type = isPool ? 'PENDING_POOL' : isPredicted ? 'PREDICTED_OFFLOAD' : 'DISRUPTION'
  const uldId = isPredicted ? 'PMC67890CX' : isPool ? 'AKE24680CX' : 'AKE12345CX'
  const origin = isPredicted ? 'HKG' : 'HKG'
  const destination = 'LHR'
  const mawb = isPredicted ? '160-98765432' : isPool ? '160-24681357' : '160-12345675'
  const now = new Date().toISOString()
  const detail: RecoveryDetail = {
    workItemId, type, status: isPool ? 'PRIORITY_HOLD' : isPredicted ? 'PREDICTED_OFFLOAD' : 'RECOVERY_REQUIRED', predictionUnit: 'ULD',
    uld: { uldId, uldType: isPredicted ? 'PMC' : 'AKE', weightKg: isPredicted ? 980 : isPool ? 860 : 1250, volumeM3: isPredicted ? 5.1 : isPool ? 5.2 : 4.2, origin, destination },
    masterAirwayBill: { number: mawb, documentId: `demo-mawb-${mawb}`, displayLabel: mawb },
    flight: { flightId, origin, destination, scheduledDeparture: null, aircraftType: null },
    cargo: { shipmentIds: [], weightKg: isPredicted ? 980 : isPool ? 860 : 1250, volumeM3: isPredicted ? 5.1 : isPool ? 5.2 : 4.2, handlingRequirements: [], commodity: null, valueAtRisk: null, currency: 'USD' },
    document: { documentId: `demo-document-${workItemId}`, version: 1, updatedAt: now }, updatedAt: now,
    caseSummary: { disruption: isPool ? 'Pending-pool candidate available for review.' : isPredicted ? 'Forecast indicates an offload risk.' : 'Confirmed disruption requires a recovery route.', capacityConstraint: 'Candidate capacity requires confirmation.', deliveryCommitment: isPool ? '10 Nov, 18:00' : isPredicted ? '11 Nov, 12:00' : '10 Nov, 18:00', baselineExpectedLoss: 0, currency: 'USD' },
    workflowControl: demoWorkflowControl, reviewHistory: [],
    ...(isPool ? { pool: { source: 'DOMINO_OFFLOAD' as const, sourceFlightId: flightId, eligibleForNoShowReplacement: false, priorityHold: true, disposition: 'PRIORITY_HOLD' as const } } : {}),
    ...(isPredicted ? { forecast: { offloadProbability: .64, capacityShortfallKg: 1250, confidence: 72, forecastedAt: now, reasons: ['Payload risk', 'Weather exposure'], forecastCargoCapacityKg: 14500, bookedWeightKg: 15750, valueAtRisk: 12000, currency: 'USD' } } : {}),
    ...(!isPool && !isPredicted ? { confirmedOffload: { confirmedAt: now, source: 'AUTHORIZED_DECISION' as const, sourceEventId: `demo-event-${workItemId}`, reason: 'Demo confirmed offload' } } : {}),
  }
  const options = isPool ? [makeDemoOption({ id: 'DEMO-AKE24680CX-01', route: 'HKG → LHR', flightId: 'CX251', capacity: 1100, arrival: '11 Nov, 02:15', delay: 8, feasibility: 'Feasibility Unknown', percent: 64, loss: 5900, currency: 'USD', network: 'May consume buffer on CX251 for other priority cargo.' })]
    : isPredicted ? [makeDemoOption({ id: 'DEMO-PMC67890CX-01', route: 'HKG → LAX', flightId: 'CX881', capacity: 1200, arrival: '17 Oct, 20:00', delay: 5, feasibility: 'Feasible', percent: 86, loss: 8200, currency: 'USD', network: 'No downstream impact identified in demo data.' })]
      : [makeDemoOption({ id: 'DEMO-AKE12345CX-01', route: 'HKG → LHR', flightId: 'CX253', capacity: 1500, arrival: '11 Nov, 06:30', delay: 12, feasibility: 'Feasibility Unknown', percent: 72, loss: 7800, currency: 'USD', network: 'Uses direct HKG-LHR capacity; onward network impact unknown.' })]
  return { detail, options, currency: 'USD' }
}

export function RecoverySolutionPage({ onNavigate, initialWorkItemId, initialFlightId }: RecoverySolutionPageProps) {
  const [data, setData] = useState<RecoverySolutionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordedOptionId, setRecordedOptionId] = useState<string | null>(null)
  useEffect(() => {
    setRecordedOptionId(null)
    if (!initialWorkItemId) { setData(null); setLoading(false); setError(null); return }
    if (initialWorkItemId.startsWith('demo-')) {
      setData(buildDemoData(initialWorkItemId, initialFlightId ?? 'Unknown flight'))
      setLoading(false); setError(null)
      return
    }
    const controller = new AbortController()
    setLoading(true); setError(null); setData(null)
    void getRecoverySolution(initialWorkItemId, controller.signal)
      .then(async (detail) => {
        let options: RecoveryOption[] = []
        if (detail.type !== 'PENDING_POOL') {
          const response: RecoveryOptionsResponse = await getRecoveryOptions(initialWorkItemId, controller.signal)
          options = response.options
        }
        if (!controller.signal.aborted) setData({ detail, options, currency: detail.cargo.currency ?? 'USD' })
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load this offload case.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [initialWorkItemId, initialFlightId])

  const detail = data?.detail
  return <div className="app-shell">
    <WorkspaceSidebar active="Recovery Solution" onNavigate={onNavigate} />
    <main className="main-content shipment-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> RECOVERY SOLUTION</div></header>
      <div className="page-heading"><div><h1>Recovery Solution</h1></div></div>
      {loading && <div className="api-state" role="status">Loading offload case…</div>}
      {error && <div className="api-state error" role="alert"><strong>Could not load offload case</strong><span>{error}</span></div>}
      {detail && data && <>
        <section className="workspace-intro recovery-case-intro selected-flight-card">
          <div><h2>Flight {detail.flight.flightId} · {detail.flight.origin} → {detail.flight.destination} · {detail.uld.uldId}</h2><small>MAWB {detail.masterAirwayBill.displayLabel} · {detail.uld.weightKg.toLocaleString()} kg · {detail.uld.volumeM3.toLocaleString()} m³</small></div>
        </section>
        {detail.forecast && <section className="analytics-note"><strong>Forecast evidence</strong><span>{Math.round(detail.forecast.offloadProbability * 100)}% offload probability · {detail.forecast.capacityShortfallKg.toLocaleString()} kg capacity shortfall · {detail.forecast.confidence}% confidence</span></section>}
        <RecoveryAgentRun detail={detail} options={data.options} currency={data.currency} onRecorded={setRecordedOptionId} />
        <section className="panel">
          <div className="panel-heading"><div><h2>Recovery options</h2><p>Total {data.options.length} {data.options.length === 1 ? 'option' : 'options'}</p></div></div>
          {data.options.length ? <div className="table-wrap recovery-options-table-wrap" tabIndex={0} aria-label="Recovery route options, scroll horizontally for more columns"><table className="recovery-comparison-table"><caption className="sr-only">Recovery route options compared by feasibility, capacity, arrival, cost, modeled loss, and network impact</caption><thead><tr><th scope="col">Route option</th><th scope="col">Feasibility</th><th scope="col">Usable capacity</th><th scope="col">Arrival</th><th scope="col">Recovery cost</th><th scope="col">Modeled loss</th><th scope="col">Network impact</th></tr></thead><tbody>{data.options.map((option) => { const recorded = recordedOptionId === option.optionId; return <tr key={option.optionId} className={recorded ? 'recommended-row' : ''} aria-selected={recorded}><td><strong>{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to}`).join(' / ')}</strong><small>{option.optionType.replaceAll('_', ' ')} · {option.recoveryLegs.map((leg) => leg.operatingFlightId).join(' / ')} · {option.optionId}</small>{recorded && <span className="recovery-recorded-inline"><Check size={14} aria-hidden="true" /> Recommendation recorded for review</span>}</td><td><strong>{option.feasibilityStatus}</strong><small>{option.feasibilityPercentage}% estimate</small></td><td><strong>{option.usableCapacityKg.toLocaleString()} kg</strong><small>{option.capacityStatus}</small></td><td><strong>{option.expectedArrival}</strong><small>{option.expectedDelayMinutes.toLocaleString()} min delay</small></td><td>{option.recoveryHandlingCost.toLocaleString()} {data.currency}</td><td><strong>{option.totalModeledExpectedLoss.toLocaleString()} {data.currency}</strong></td><td>{option.networkImpact}</td></tr>})}</tbody></table><p className="recovery-table-hint">Scroll horizontally to compare every field</p></div> : <div className="empty-state"><strong>No recovery options available</strong><span>{detail.type === 'PENDING_POOL' ? 'Pool candidates are evaluated against an active disruption or predicted-offload target.' : 'The API returned no route options for this case.'}</span></div>}
        </section>
        {detail.reviewHistory.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Review history</h2></div></div><div className="table-wrap"><table><thead><tr><th>DECISION</th><th>REVIEWER</th><th>REASON</th><th>REVIEWED</th></tr></thead><tbody>{detail.reviewHistory.map((review) => <tr key={review.decisionId}><td>{review.decision.replaceAll('_', ' ')}</td><td>{review.reviewerId}</td><td>{review.reason}</td><td>{new Date(review.reviewedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>}
      </>}
      {!detail && !loading && !error && <div className="empty-state"><strong>Select a flight record to open its recovery case</strong></div>}
    </main>
  </div>
}
