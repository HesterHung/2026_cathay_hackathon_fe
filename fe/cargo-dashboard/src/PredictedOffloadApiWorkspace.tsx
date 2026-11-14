import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getRecoveryOption,
  getRecoveryOptions,
  getRecoverySolution,
  listRecoverySolutions,
  RecoveryApiError,
  saveRecoveryDecision,
  type FlightSummary,
  type RecoveryDetail,
  type RecoveryListResponse,
  type RecoveryOptionDetail,
  type RecoveryOptionsResponse,
  type RecoveryWorkItem,
} from './recoveryApi'
import { RecoveryApiUnavailablePreview, RecoveryDeadlineNotice, RecoveryQueueFilterBar, RecoveryReviewHistory, RecoveryStatusBadge, RecoveryWorkflowPanel, RecoveryWorkItemTable } from './RecoveryQueueShared'
import { emptyRecoveryQueueFilters, isQueueDecisionAllowed, recoveryFilterQuery, type RecoveryQueueFilters } from './recoveryQueueUi'

function toApiError(error: unknown): RecoveryApiError {
  return error instanceof RecoveryApiError ? error : new RecoveryApiError(error instanceof Error ? error.message : 'Unexpected API error.', 'http')
}

function apiErrorLabel(error: RecoveryApiError): string {
  const labels: Record<RecoveryApiError['kind'], string> = {
    network: 'Network error', authorization: 'Authorization required', 'not-found': 'API endpoint or record not found',
    validation: 'Validation failed', conflict: 'Record changed; refresh before retrying', gated: 'Higher-priority workflow gate',
    server: 'Recovery API server error', http: 'Recovery API request failed', 'invalid-response': 'Invalid API response',
  }
  return `${labels[error.kind]}: ${error.message}${error.details === undefined ? '' : ` ${JSON.stringify(error.details)}`}`
}

function timeLabel(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : 'Unavailable'
}

function amountLabel(value: number | null | undefined, currency: string | null | undefined): string {
  return value === null || value === undefined || !currency ? 'Unavailable' : `${currency} ${Math.round(value).toLocaleString()}`
}

function kgLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Unavailable' : `${value.toLocaleString()} kg`
}

function uldsForFlight(items: RecoveryWorkItem[], flightId: string): RecoveryWorkItem[] {
  return items.filter((item) => item.flight.flightId === flightId && item.type === 'PREDICTED_OFFLOAD')
}

function FlightCapacityEvidence({ summary }: { summary: FlightSummary }) {
  const booked = Math.max(0, summary.bookedWeightKg)
  const forecastCapacity = Math.max(0, summary.forecastCargoCapacityKg)
  const scale = Math.max(booked, forecastCapacity, 1)
  const bookedWidth = `${Math.min(100, booked / scale * 100)}%`
  const capacityWidth = `${Math.min(100, forecastCapacity / scale * 100)}%`
  const shortfall = Math.max(0, summary.capacityShortfallKg)
  return <section className="predicted-capacity-evidence" aria-label={`Flight-level capacity evidence for ${summary.flightId}`}>
    <div className="predicted-capacity-heading"><div><small>FLIGHT-LEVEL CAPACITY EVIDENCE</small><strong>{shortfall > 0 ? `${shortfall.toLocaleString()} kg shortfall` : 'No shortfall reported'}</strong></div><span>Forecast service</span></div>
    <div className="predicted-capacity-bars">
      <div className="predicted-capacity-row"><div><span>Booked load</span><strong>{booked.toLocaleString()} kg</strong></div><div className="predicted-capacity-track" aria-hidden="true"><i className="booked-load" style={{ width: bookedWidth }} /></div></div>
      <div className="predicted-capacity-row"><div><span>Forecast cargo capacity</span><strong>{forecastCapacity.toLocaleString()} kg</strong></div><div className="predicted-capacity-track" aria-hidden="true"><i className="forecast-capacity" style={{ width: capacityWidth }} /></div></div>
    </div>
  </section>
}

export function PredictedOffloadApiWorkspace({ initialFlightId, onOpenRecovery }: { initialFlightId?: string; onOpenRecovery: (workItemId: string, flightId: string) => void }) {
  const [list, setList] = useState<RecoveryListResponse | null>(null)
  const [listError, setListError] = useState<RecoveryApiError | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filterDraft, setFilterDraft] = useState<RecoveryQueueFilters>(emptyRecoveryQueueFilters)
  const [filters, setFilters] = useState<RecoveryQueueFilters>(emptyRecoveryQueueFilters)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedFlightId, setSelectedFlightId] = useState(initialFlightId ?? '')
  const selectedFlightIdRef = useRef(initialFlightId ?? '')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [detail, setDetail] = useState<RecoveryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<RecoveryApiError | null>(null)
  const [options, setOptions] = useState<RecoveryOptionsResponse | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<RecoveryApiError | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [optionDetail, setOptionDetail] = useState<RecoveryOptionDetail | null>(null)
  const [optionDetailLoading, setOptionDetailLoading] = useState(false)
  const [optionDetailError, setOptionDetailError] = useState<RecoveryApiError | null>(null)
  const [decision, setDecision] = useState<'APPROVE_FOR_REVIEW' | 'REJECT_OVERRIDE'>('APPROVE_FOR_REVIEW')
  const [reviewerId, setReviewerId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<RecoveryApiError | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const resetSelectedWork = useCallback(() => {
    setDetail(null); setDetailError(null); setOptions(null); setOptionsError(null)
    setSelectedOptionId(''); setOptionDetail(null); setOptionDetailError(null); setSaveError(null)
  }, [])

  const refreshQueue = useCallback(() => {
    setListLoading(true); setListError(null)
    setRefreshKey((current) => current + 1)
  }, [])
  const manualRefresh = () => { setSavedMessage(null); refreshQueue() }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void listRecoverySolutions({ type: 'PREDICTED_OFFLOAD', page, limit: 100, ...recoveryFilterQuery(filters) }, controller.signal).then((result) => {
        setList(result)
        setFetchedAt(new Date().toISOString())
        resetSelectedWork()
        const nextFlight = result.flightSummaries.some((item) => item.flightId === selectedFlightIdRef.current)
          ? selectedFlightIdRef.current
          : result.flightSummaries[0]?.flightId ?? ''
        selectedFlightIdRef.current = nextFlight
        setSelectedFlightId(nextFlight)
        const flightItems = uldsForFlight(result.items, nextFlight)
        setSelectedWorkItemId((current) => result.items.some((item) => item.workItemId === current) ? current : flightItems[0]?.workItemId ?? result.items[0]?.workItemId ?? '')
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setListError(toApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setListLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [page, refreshKey, resetSelectedWork, filters])

  useEffect(() => {
    if (!selectedWorkItemId) return
    const controller = new AbortController()
    const workItemId = selectedWorkItemId
    const timer = window.setTimeout(() => {
      setDetailLoading(true); setOptionsLoading(true)
      setDetailError(null); setOptionsError(null); setSaveError(null)
      setDetail(null); setOptions(null); setSelectedOptionId(''); setOptionDetail(null); setOptionDetailError(null)
      void getRecoverySolution(workItemId, controller.signal).then((result) => {
        if (result.type !== 'PREDICTED_OFFLOAD' || result.confirmedOffload) {
          throw new RecoveryApiError('The selected item is not an unconfirmed PREDICTED_OFFLOAD record.', 'invalid-response')
        }
        setDetail(result)
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setDetailError(toApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
      void getRecoveryOptions(workItemId, controller.signal).then((result) => {
        if (result.type !== 'PREDICTED_OFFLOAD') throw new RecoveryApiError('Route options are not for a PREDICTED_OFFLOAD record.', 'invalid-response')
        setOptions(result)
        setSelectedOptionId(result.bestOptions[0] ?? result.options[0]?.optionId ?? '')
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOptionsError(toApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setOptionsLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selectedWorkItemId, refreshKey])

  useEffect(() => {
    if (!selectedWorkItemId || !selectedOptionId) return
    const controller = new AbortController()
    const workItemId = selectedWorkItemId
    const optionId = selectedOptionId
    const timer = window.setTimeout(() => {
      setOptionDetailLoading(true); setOptionDetailError(null)
      void getRecoveryOption(workItemId, optionId, controller.signal).then((result) => setOptionDetail(result)).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOptionDetailError(toApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setOptionDetailLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selectedWorkItemId, selectedOptionId, refreshKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const summaries = list?.flightSummaries ?? []
  const items = list?.items ?? []
  const summaryFlightIds = new Set(summaries.map((summary) => summary.flightId))
  const listWorkflow = list?.workflowControl
  const selectedListItem = items.find((item) => item.workItemId === selectedWorkItemId)
  const activeDetail = detail?.workItemId === selectedWorkItemId ? detail : null
  const activeOptions = options?.workItemId === selectedWorkItemId ? options : null
  const activeOptionDetail = optionDetail?.workItemId === selectedWorkItemId && optionDetail.option.optionId === selectedOptionId ? optionDetail : null
  const stale = Boolean(fetchedAt && now - Date.parse(fetchedAt) > 5 * 60 * 1000)
  const priorityBlocked = Boolean((listWorkflow && !listWorkflow.canWorkPredictions) || (activeDetail && !activeDetail.workflowControl.canWorkPredictions))
  const canApprove = Boolean(
    listWorkflow?.canWorkPredictions && activeDetail?.workflowControl.canWorkPredictions &&
    isQueueDecisionAllowed(listWorkflow, activeDetail.workflowControl, 'PREDICTED_OFFLOAD', 'APPROVE_FOR_REVIEW'),
  )
  const canReject = Boolean(
    listWorkflow?.canWorkPredictions && activeDetail?.workflowControl.canWorkPredictions &&
    isQueueDecisionAllowed(listWorkflow, activeDetail.workflowControl, 'PREDICTED_OFFLOAD', 'REJECT_OVERRIDE'),
  )

  const saveReview = async () => {
    if (!activeDetail || !reviewerId.trim() || !reason.trim()) return
    if ((decision === 'APPROVE_FOR_REVIEW' && !canApprove) || (decision === 'REJECT_OVERRIDE' && !canReject)) return
    if ((decision === 'APPROVE_FOR_REVIEW' && !canApprove) || (decision === 'REJECT_OVERRIDE' && !canReject)) return
    setSaving(true); setSaveError(null)
    try {
      await saveRecoveryDecision(activeDetail.workItemId, {
        type: 'PREDICTED_OFFLOAD', uldId: activeDetail.uld.uldId,
        masterAirwayBillNumber: activeDetail.masterAirwayBill.number,
        documentVersion: activeDetail.document.version,
        optionId: decision === 'APPROVE_FOR_REVIEW' ? selectedOptionId : null,
        decision, reason: reason.trim(), reviewerId: reviewerId.trim(), reviewedAt: new Date().toISOString(),
      })
      setReason('')
      setSavedMessage('Review saved. The forecast remains unconfirmed; no route was booked or executed.')
      refreshQueue()
    } catch (error) {
      setSaveError(toApiError(error))
    } finally { setSaving(false) }
  }

  return <section className="panel predicted-api-workspace">
    <div className="panel-heading"><div><h2>Predicted Offload · live recovery work</h2></div><button className="outline-button" type="button" disabled={listLoading} onClick={manualRefresh}>{listLoading ? 'Loading…' : 'Refresh queue'}</button></div>
    {listLoading && !list && <div className="empty-state" role="status"><strong>Loading predicted-offload queue</strong><span>Fetching ULD work items and forecast service flight summaries.</span></div>}
    {listError && <div className="api-state error" role="alert"><strong>{listError.kind === 'authorization' ? 'Authorization required' : listError.kind === 'not-found' ? 'Recovery API endpoint is unavailable' : 'Could not load predicted-offload queue'}</strong><span>{apiErrorLabel(listError)}</span>{list && <small>Showing the last successful response from {timeLabel(fetchedAt)}.</small>}</div>}
    {listError && !list && <RecoveryApiUnavailablePreview type="PREDICTED_OFFLOAD" onOpenRecovery={onOpenRecovery} />}
    {stale && <div className="api-state stale" role="status"><strong>Forecast queue may be stale</strong><span>The last successful response is over five minutes old. Refresh before reviewing a ULD.</span></div>}
    {savedMessage && <div className="api-state success" role="status"><strong>{savedMessage}</strong><span>The latest forecast record and review history are being reloaded.</span></div>}
    {list && <>
      {!listError && <div className="api-state success" role="status"><strong>{list.totalItems} matching predicted-offload ULD work item(s)</strong><span>{summaries.length} flight-level summary records · fetched {timeLabel(fetchedAt)} · page {list.pagination.page} of {list.pagination.totalPages}</span></div>}
      <RecoveryWorkflowPanel type="PREDICTED_OFFLOAD" queueControl={list.workflowControl} itemControl={activeDetail?.workflowControl} />
      <RecoveryQueueFilterBar value={filterDraft} disabled={listLoading} onChange={setFilterDraft} onApply={() => { setPage(1); setFilters({ flightId: filterDraft.flightId.trim(), masterAirwayBillNumber: filterDraft.masterAirwayBillNumber.trim(), status: filterDraft.status.trim() }) }} onClear={() => { setFilterDraft(emptyRecoveryQueueFilters); setFilters(emptyRecoveryQueueFilters); setPage(1) }} />
      {list.items.length === 0 && <div className="empty-state"><strong>No predicted-offload ULD work items</strong><span>The API returned an empty queue. No fixture records are substituted here.</span></div>}
      {list.items.length > 0 && <RecoveryWorkItemTable type="PREDICTED_OFFLOAD" items={items} selectedWorkItemId={selectedWorkItemId} onOpenRecovery={onOpenRecovery} onSelect={(item) => { setSavedMessage(null); selectedFlightIdRef.current = item.flight.flightId; setSelectedFlightId(summaryFlightIds.has(item.flight.flightId) ? item.flight.flightId : ''); resetSelectedWork(); setSelectedWorkItemId(item.workItemId) }} />}
      {list.items.length > 0 && summaries.length === 0 && <div className="api-state error" role="alert"><strong>Flight summaries missing</strong><span>The predicted-offload contract requires forecast-service flight summaries. ULD records are available, but flight-level triage is not inferred from ULD probabilities.</span></div>}
      {summaries.length > 0 && <section className="predicted-flight-summary-grid" aria-label="Flight forecast summaries">{summaries.map((summary: FlightSummary) => {
        const summaryUlds = uldsForFlight(items, summary.flightId)
        const selected = selectedFlightId === summary.flightId
        return <article key={summary.flightId} className={`predicted-flight-summary ${selected ? 'selected' : ''}`}>
            <button type="button" className="predicted-flight-select" onClick={() => {
            setSavedMessage(null)
            selectedFlightIdRef.current = summary.flightId
            setSelectedFlightId(summary.flightId)
            resetSelectedWork()
            setSelectedWorkItemId(summaryUlds[0]?.workItemId ?? '')
          }} aria-pressed={selected}>
            <span><strong>{summary.flightId}</strong><small>{summary.origin} → {summary.destination} · {summary.aircraftType ?? 'Aircraft unavailable'}</small><small>Scheduled departure · {timeLabel(summary.scheduledDeparture)}</small></span>
            <RecoveryStatusBadge type="PREDICTED_OFFLOAD" status="AT_RISK">FLIGHT FORECAST</RecoveryStatusBadge>
          </button>
          <FlightCapacityEvidence summary={summary} />
          <div className="predicted-flight-metrics">
            <span><small>FLIGHT OFFLOAD PROBABILITY</small><b>{Math.round(summary.offloadProbability * 100)}%</b></span>
            <span><small>CONFIDENCE</small><b>{summary.confidence}%</b></span>
            <span><small>VALUE AT RISK</small><b>{amountLabel(summary.valueAtRisk, summary.currency)}</b></span>
            <span><small>AFFECTED CARGO</small><b>{summary.affectedUldCount} ULD(s) · {summary.shipmentIds.length} shipment(s)</b></span>
          </div>
          <div className="predicted-flight-forecast"><strong>Forecast time</strong><span>{timeLabel(summary.forecastedAt)}</span><strong>Reasons</strong><span>{summary.reasons.join('; ') || 'No reasons supplied'}</span><small>Flight-level forecast supplied by the forecasting service. It is not calculated from constituent ULD probabilities.</small></div>
        </article>
      })}</section>}
      {selectedListItem && <section className="predicted-uld-detail">
        {detailLoading && <div className="empty-state" role="status"><strong>Loading ULD forecast evidence</strong><span>Reading the selected ULD, its document version, and review history.</span></div>}
        {detailError && <div className="api-state error" role="alert"><strong>Could not load ULD detail</strong><span>{apiErrorLabel(detailError)}</span></div>}
        {activeDetail && <>
          <div className="disruption-api-detail-head"><div><p className="eyebrow">PREDICTED · NOT CONFIRMED · {activeDetail.status}</p><h3>{activeDetail.uld.uldId} <span>· {activeDetail.masterAirwayBill.displayLabel}</span></h3><p>{activeDetail.flight.flightId} · {activeDetail.flight.origin} → {activeDetail.flight.destination} · {activeDetail.flight.aircraftType ?? 'Aircraft unavailable'}</p></div><RecoveryStatusBadge type="PREDICTED_OFFLOAD" status={activeDetail.status}>NO OFFLOAD CONFIRMATION</RecoveryStatusBadge></div>
          {activeDetail.forecast ? <div className="disruption-api-facts">
            <article><small>ULD OFFLOAD PROBABILITY</small><strong>{(activeDetail.forecast.offloadProbability * 100).toFixed(1)}%</strong><span>ULD-level forecast · separate from flight probability</span></article>
            <article><small>CONFIDENCE / FORECAST TIME</small><strong>{activeDetail.forecast.confidence}%</strong><span>{timeLabel(activeDetail.forecast.forecastedAt)}</span></article>
            <article><small>SHORTFALL / BOOKED WEIGHT</small><strong>{kgLabel(activeDetail.forecast.capacityShortfallKg)}</strong><span>{kgLabel(activeDetail.forecast.bookedWeightKg)} booked</span></article>
            <article><small>FORECAST CARGO CAPACITY</small><strong>{kgLabel(activeDetail.forecast.forecastCargoCapacityKg)}</strong><span>{amountLabel(activeDetail.forecast.valueAtRisk, activeDetail.forecast.currency)}</span></article>
          </div> : <div className="api-state error" role="alert"><strong>Forecast evidence missing</strong><span>This record is typed as predicted offload but has no forecast object. Review is disabled.</span></div>}
          <RecoveryDeadlineNotice commitment={activeDetail.caseSummary?.deliveryCommitment} />
          <section className="disruption-api-evidence"><h4>Forecast reasons and affected cargo</h4><p>{activeDetail.forecast?.reasons.join('; ') || 'No forecast reasons supplied.'}</p><dl><div><dt>Shipment IDs</dt><dd>{activeDetail.cargo.shipmentIds.join(', ') || 'Unavailable'}</dd></div><div><dt>Cargo</dt><dd>{activeDetail.cargo.commodity ?? 'Commodity unavailable'} · {kgLabel(activeDetail.cargo.weightKg)} · {activeDetail.cargo.volumeM3.toLocaleString()} m³</dd></div><div><dt>ULD / handling</dt><dd>{activeDetail.uld.uldType} · {activeDetail.cargo.handlingRequirements.join(', ') || 'Handling requirements unavailable'}</dd></div><div><dt>Delivery commitment</dt><dd>{activeDetail.caseSummary?.deliveryCommitment ?? 'Unavailable'}</dd></div></dl></section>
          {activeDetail.confirmedOffload && <div className="api-state error" role="alert"><strong>Unexpected confirmation evidence</strong><span>The API returned a confirmation object for a PREDICTED_OFFLOAD. This contract mismatch blocks review. This page will not transition the item.</span></div>}
          <section className="disruption-api-options"><div className="panel-heading"><div><h4>Routing options</h4><p>Review evidence only. Approval does not confirm an offload, book a route, or execute an allocation.</p></div></div>
            {optionsLoading && <p role="status">Loading routing options…</p>}{optionsError && <div className="api-state error" role="alert"><strong>Could not load route options</strong><span>{apiErrorLabel(optionsError)}</span></div>}
            {activeOptions && activeOptions.options.length === 0 && <div className="empty-state"><strong>No routing options returned</strong><span>No route candidate is available for this predicted ULD.</span></div>}
            {activeOptions && activeOptions.options.length > 0 && <div className="table-wrap"><table><thead><tr><th>OPTION</th><th>ROUTE</th><th>FEASIBILITY</th><th>CAPACITY</th><th>ARRIVAL / DELAY</th><th>MODELED LOSS</th><th>EVIDENCE</th></tr></thead><tbody>{activeOptions.options.map((option) => <tr key={option.optionId} className={selectedOptionId === option.optionId ? 'recommended-row' : ''}><td><strong>{option.optionType}</strong><small>{option.optionId}{activeOptions.bestOptions.includes(option.optionId) ? ' · best modeled option' : ''}</small></td><td>{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to} (${leg.operatingFlightId})`).join(' · ')}</td><td>{option.feasibilityStatus}<small>{option.feasibilityPercentage}% · unknown remains unknown</small></td><td>{option.capacityStatus}<small>{kgLabel(option.usableCapacityKg)}</small></td><td>{timeLabel(option.expectedArrival)}<small>{option.expectedDelayMinutes} min delay</small></td><td>{amountLabel(option.totalModeledExpectedLoss, activeOptions.currency)}</td><td><button className="text-button" type="button" onClick={() => { setOptionDetail(null); setOptionDetailError(null); setSelectedOptionId(option.optionId) }}>Review evidence</button><small>{option.missingData.length ? `${option.missingData.length} outstanding item(s)` : 'No missing data reported'}</small></td></tr>)}</tbody></table></div>}
            {optionDetailLoading && <p role="status">Loading selected option detail…</p>}{optionDetailError && <div className="api-state error" role="alert"><strong>Could not load option detail</strong><span>{apiErrorLabel(optionDetailError)}</span></div>}
            {activeOptionDetail && <div className="disruption-option-detail"><div><h4>{activeOptionDetail.option.optionId} · evaluation evidence</h4><p>{activeOptionDetail.explanation.summary}</p><p>{activeOptionDetail.option.networkImpact}</p></div><dl><div><dt>Cargo / customer impact</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.cargoCustomerImpact, activeOptionDetail.costBreakdown.currency)}</dd></div><div><dt>Carrier contribution</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.cathayContributionImpact, activeOptionDetail.costBreakdown.currency)}</dd></div><div><dt>Recovery handling</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.recoveryAndHandlingCost, activeOptionDetail.costBreakdown.currency)}</dd></div><div><dt>Delay / service</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.delayAndServiceImpact, activeOptionDetail.costBreakdown.currency)}</dd></div><div><dt>Downstream network</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.downstreamNetworkImpact, activeOptionDetail.costBreakdown.currency)}</dd></div><div><dt>Total modeled expected loss</dt><dd>{amountLabel(activeOptionDetail.costBreakdown.totalModeledExpectedLoss, activeOptionDetail.costBreakdown.currency)}</dd></div></dl><div><strong>Assumptions</strong>{activeOptionDetail.explanation.assumptions.length ? <ul>{activeOptionDetail.explanation.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul> : <p>No assumptions returned.</p>}</div><p><strong>Missing evidence:</strong> {[...new Set([...activeOptionDetail.explanation.missingData, ...activeOptionDetail.option.missingData])].join('; ') || 'None reported'}</p></div>}
          </section>
          <section className="disruption-review-form"><div><h4>Record a prediction review</h4><p>The work item remains PREDICTED_OFFLOAD after either review decision.</p></div><div className="settings-form"><label>Review decision<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="APPROVE_FOR_REVIEW">Approve selected route for review</option><option value="REJECT_OVERRIDE">Reject / record override</option></select></label><label>Reviewer ID<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} required placeholder="Operator ID" /></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} placeholder="Explain this review decision" /></label><button className="primary-button" type="button" disabled={saving || listLoading || Boolean(listError) || stale || priorityBlocked || !activeDetail.forecast || Boolean(activeDetail.confirmedOffload) || !reason.trim() || !reviewerId.trim() || (decision === 'APPROVE_FOR_REVIEW' && (!selectedOptionId || !canApprove)) || (decision === 'REJECT_OVERRIDE' && !canReject)} onClick={() => void saveReview()}>{saving ? 'Saving review…' : 'Save review'}</button>{stale && <small>Refresh the queue before saving a decision from stale data.</small>}{priorityBlocked && <small>Review actions are gated by the active workflow priority. ULD details and forecast evidence remain available for inspection.</small>}{!priorityBlocked && decision === 'APPROVE_FOR_REVIEW' && !canApprove && <small>Approval is not listed as an allowed action by both the queue and ULD detail responses. The item remains available for inspection.</small>}{!priorityBlocked && decision === 'REJECT_OVERRIDE' && !canReject && <small>Rejection is not listed as an allowed action by both the queue and ULD detail responses. The item remains available for inspection.</small>}{activeDetail.workflowControl.message && <small>{activeDetail.workflowControl.message}{activeDetail.workflowControl.blockingWorkItemIds.length ? ` Blocking work: ${activeDetail.workflowControl.blockingWorkItemIds.join(', ')}.` : ''}</small>}</div>{saveError && <div className="api-state error" role="alert"><strong>Review was not saved</strong><span>{apiErrorLabel(saveError)}</span>{saveError.kind === 'conflict' && <button className="text-button" type="button" onClick={refreshQueue}>Refresh latest document version</button>}</div>}</section>
          <RecoveryReviewHistory reviews={activeDetail.reviewHistory} title="Saved ULD review history" />
        </>}
      </section>}
      <div className="recovery-api-pagination"><span>Page {list.pagination.page} of {list.pagination.totalPages} · {list.totalItems} predicted ULDs</span><div><button className="outline-button" type="button" disabled={listLoading || page <= 1} onClick={() => { setListLoading(true); setListError(null); setSavedMessage(null); setPage((value) => Math.max(1, value - 1)) }}>Previous</button><button className="outline-button" type="button" disabled={listLoading || !list.pagination.hasNextPage} onClick={() => { setListLoading(true); setListError(null); setSavedMessage(null); setPage((value) => value + 1) }}>Next</button></div></div>
    </>}
  </section>
}
