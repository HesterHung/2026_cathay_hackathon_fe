import { useCallback, useEffect, useState } from 'react'
import {
  getRecoveryOption,
  getRecoveryOptions,
  getRecoverySolution,
  listRecoverySolutions,
  RecoveryApiError,
  saveRecoveryDecision,
  type RecoveryDetail,
  type RecoveryListResponse,
  type RecoveryOptionDetail,
  type RecoveryOptionsResponse,
} from './recoveryApi'
import { RecoveryApiUnavailablePreview, RecoveryDeadlineNotice, RecoveryQueueFilterBar, RecoveryReviewHistory, RecoveryStatusBadge, RecoveryWorkflowPanel, RecoveryWorkItemTable } from './RecoveryQueueShared'
import { emptyRecoveryQueueFilters, isQueueDecisionAllowed, recoveryFilterQuery, type RecoveryQueueFilters } from './recoveryQueueUi'

function messageFor(error: RecoveryApiError): string {
  const heading: Record<RecoveryApiError['kind'], string> = {
    network: 'Network error', authorization: 'Authorization required', 'not-found': 'API endpoint or record not found',
    validation: 'Validation failed', conflict: 'This record changed since it was loaded', gated: 'Higher-priority workflow gate',
    server: 'Recovery API server error', http: 'Recovery API request failed', 'invalid-response': 'Invalid API response',
  }
  const details = error.details === undefined ? '' : ` ${JSON.stringify(error.details)}`
  return `${heading[error.kind]}: ${error.message}${details}`
}

function asApiError(error: unknown): RecoveryApiError {
  return error instanceof RecoveryApiError ? error : new RecoveryApiError(error instanceof Error ? error.message : 'Unexpected API error.', 'http')
}

function formatTimestamp(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : 'Unavailable'
}

function formatMoney(value: number | null | undefined, currency: string | null | undefined): string {
  return value === null || value === undefined || !currency ? 'Unavailable' : `${currency} ${Math.round(value).toLocaleString()}`
}

function AdditionalOptionEvidence({ detail }: { detail: RecoveryOptionDetail }) {
  return <section className="disruption-option-detail">
    <h4>Network and scenario evidence</h4>
    <p>{detail.networkDominoEffect.summary} · additional capacity shortfall {detail.networkDominoEffect.additionalCapacityShortfallKg.toLocaleString()} kg.</p>
    <small>Affected flights: {detail.networkDominoEffect.affectedFlights.join(', ') || 'None reported'} · Affected ULDs: {detail.networkDominoEffect.affectedUldIds.join(', ') || 'None reported'}</small>
    {detail.scenarioSensitivity.length > 0 && <div className="table-wrap"><table><thead><tr><th>SCENARIO CHANGE</th><th>FEASIBILITY</th><th>MODELED LOSS</th></tr></thead><tbody>{detail.scenarioSensitivity.map((item) => <tr key={item.inputChange}><td>{item.inputChange}</td><td>{item.feasibilityStatus}</td><td>{formatMoney(item.costBreakdown.totalModeledExpectedLoss, item.costBreakdown.currency)}</td></tr>)}</tbody></table></div>}
  </section>
}

export function DisruptionApiWorkspace() {
  const [list, setList] = useState<RecoveryListResponse | null>(null)
  const [listError, setListError] = useState<RecoveryApiError | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [listFetchedAt, setListFetchedAt] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filterDraft, setFilterDraft] = useState<RecoveryQueueFilters>(emptyRecoveryQueueFilters)
  const [filters, setFilters] = useState<RecoveryQueueFilters>(emptyRecoveryQueueFilters)
  const [refreshId, setRefreshId] = useState(0)
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [detail, setDetail] = useState<RecoveryDetail | null>(null)
  const [detailError, setDetailError] = useState<RecoveryApiError | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [options, setOptions] = useState<RecoveryOptionsResponse | null>(null)
  const [optionsError, setOptionsError] = useState<RecoveryApiError | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [optionDetail, setOptionDetail] = useState<RecoveryOptionDetail | null>(null)
  const [optionDetailError, setOptionDetailError] = useState<RecoveryApiError | null>(null)
  const [optionDetailLoading, setOptionDetailLoading] = useState(false)
  const [decision, setDecision] = useState<'APPROVE_FOR_REVIEW' | 'REJECT_OVERRIDE'>('APPROVE_FOR_REVIEW')
  const [reason, setReason] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [saveError, setSaveError] = useState<RecoveryApiError | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(0)

  const clearSelectedRecord = () => {
    setDetail(null); setOptions(null); setSelectedOptionId(''); setOptionDetail(null)
    setDetailError(null); setOptionsError(null); setOptionDetailError(null); setSaveError(null)
  }
  const refreshList = useCallback(() => {
    setListLoading(true)
    setListError(null)
    setRefreshId((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void listRecoverySolutions({ type: 'DISRUPTION', page, limit: 100, ...recoveryFilterQuery(filters) }, controller.signal).then((result) => {
      setList(result)
      setListFetchedAt(new Date().toISOString())
      clearSelectedRecord()
      setSelectedWorkItemId((current) => result.items.some((item) => item.workItemId === current) ? current : result.items[0]?.workItemId ?? '')
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setListError(asApiError(error))
    }).finally(() => { if (!controller.signal.aborted) setListLoading(false) })
    return () => controller.abort()
  }, [page, refreshId, filters])

  useEffect(() => {
    if (!selectedWorkItemId) {
      return
    }
    const controller = new AbortController()
    const workItemId = selectedWorkItemId
    const timer = window.setTimeout(() => {
      setDetailLoading(true); setOptionsLoading(true)
      setDetailError(null); setOptionsError(null); setSaveError(null)
      setDetail(null); setOptions(null); setSelectedOptionId(''); setOptionDetail(null); setOptionDetailError(null)
      void getRecoverySolution(workItemId, controller.signal).then((result) => setDetail(result)).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setDetailError(asApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
      void getRecoveryOptions(workItemId, controller.signal).then((result) => {
        setOptions(result); setSelectedOptionId((current) => result.options.some((option) => option.optionId === current) ? current : result.bestOptions[0] ?? result.options[0]?.optionId ?? '')
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOptionsError(asApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setOptionsLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selectedWorkItemId, refreshId])

  useEffect(() => {
    if (!selectedWorkItemId || !selectedOptionId) return
    const controller = new AbortController()
    const workItemId = selectedWorkItemId
    const optionId = selectedOptionId
    const timer = window.setTimeout(() => {
      setOptionDetailLoading(true); setOptionDetailError(null)
      void getRecoveryOption(workItemId, optionId, controller.signal).then((result) => setOptionDetail(result)).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOptionDetailError(asApiError(error))
      }).finally(() => { if (!controller.signal.aborted) setOptionDetailLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selectedWorkItemId, selectedOptionId, refreshId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const canApprove = isQueueDecisionAllowed(list?.workflowControl, detail?.workflowControl, 'DISRUPTION', 'APPROVE_FOR_REVIEW')
  const canReject = isQueueDecisionAllowed(list?.workflowControl, detail?.workflowControl, 'DISRUPTION', 'REJECT_OVERRIDE')
  const isStale = Boolean(listFetchedAt && now - Date.parse(listFetchedAt) > 5 * 60 * 1000)

  const saveReview = async () => {
    if (!detail || !reason.trim() || !reviewerId.trim()) return
    if ((decision === 'APPROVE_FOR_REVIEW' && !canApprove) || (decision === 'REJECT_OVERRIDE' && !canReject)) return
    setSaving(true); setSaveError(null)
    try {
      await saveRecoveryDecision(detail.workItemId, {
        type: 'DISRUPTION', uldId: detail.uld.uldId, masterAirwayBillNumber: detail.masterAirwayBill.number,
        documentVersion: detail.document.version, optionId: decision === 'APPROVE_FOR_REVIEW' ? selectedOptionId : null,
        decision, reason: reason.trim(), reviewerId: reviewerId.trim(), reviewedAt: new Date().toISOString(),
      })
      setReason('')
      setSavedMessage('Review saved. It records operator intent only and does not book or execute the route.')
      refreshList()
    } catch (error) {
      setSavedMessage(null)
      setSaveError(asApiError(error))
    } finally { setSaving(false) }
  }

  return <section className="panel disruption-api-workspace">
    <div className="panel-heading"><div><h2>Disruption Alerts · live recovery work</h2><p>Authoritative API work items grouped by MAWB. ULD evidence and decisions remain independent inside each group.</p></div><button className="outline-button" type="button" disabled={listLoading} onClick={refreshList}>{listLoading ? 'Loading…' : 'Refresh queue'}</button></div>
    {listLoading && !list && <div className="empty-state" role="status"><strong>Loading confirmed disruptions</strong><span>Fetching the DISRUPTION queue from the recovery-solutions API.</span></div>}
    {listError && <div className="api-state error" role="alert"><strong>{listError.kind === 'authorization' ? 'Authorization required' : listError.kind === 'not-found' ? 'Recovery API endpoint is unavailable' : 'Could not load disruption queue'}</strong><span>{messageFor(listError)}</span>{list && <small>Showing the last successful queue response from {formatTimestamp(listFetchedAt)}.</small>}</div>}
    {listError && !list && <RecoveryApiUnavailablePreview type="DISRUPTION" />}
    {isStale && <div className="api-state stale" role="status"><strong>Queue data may be stale</strong><span>Last successful response was over five minutes ago. Refresh before recording a review.</span></div>}
    {savedMessage && <div className="api-state success" role="status"><strong>{savedMessage}</strong><span>The latest ULD document version and review history are being reloaded.</span></div>}
    {list && <>
      {!listError && <div className="api-state success" role="status"><strong>{list.totalItems ? `${list.totalItems} matching disruption work item(s)` : 'No matching disruption work items'}</strong><span>Checked {formatTimestamp(listFetchedAt)} · page {list.pagination.page} of {list.pagination.totalPages}</span></div>}
      <RecoveryWorkflowPanel type="DISRUPTION" queueControl={list.workflowControl} itemControl={detail?.workItemId === selectedWorkItemId ? detail.workflowControl : undefined} />
      <RecoveryQueueFilterBar value={filterDraft} disabled={listLoading} onChange={setFilterDraft} onApply={() => { setPage(1); setFilters({ flightId: filterDraft.flightId.trim(), masterAirwayBillNumber: filterDraft.masterAirwayBillNumber.trim(), status: filterDraft.status.trim() }) }} onClear={() => { setFilterDraft(emptyRecoveryQueueFilters); setFilters(emptyRecoveryQueueFilters); setPage(1) }} />
      {list.items.length === 0 ? <div className="empty-state"><strong>No confirmed disruption work on this page</strong><span>The live API returned an empty DISRUPTION page. No fixture records are substituted into this queue.</span></div> : <>
        <RecoveryWorkItemTable type="DISRUPTION" items={list.items} selectedWorkItemId={selectedWorkItemId} onSelect={(item) => { setSavedMessage(null); clearSelectedRecord(); setSelectedWorkItemId(item.workItemId) }} />
        {detailLoading && <div className="empty-state" role="status"><strong>Loading ULD evidence</strong><span>Reading confirmation and document version for the selected work item.</span></div>}
        {detailError && <div className="api-state error" role="alert"><strong>Could not load disruption details</strong><span>{messageFor(detailError)}</span></div>}
        {detail && <>
          <div className="disruption-api-detail-head"><div><p className="eyebrow">{detail.status} · ULD-LEVEL CASE</p><h3>{detail.uld.uldId} <span>· {detail.masterAirwayBill.displayLabel}</span></h3><p>{detail.flight.flightId} · {detail.flight.origin} → {detail.flight.destination} · {detail.flight.aircraftType ?? 'Aircraft unavailable'}</p></div><RecoveryStatusBadge type="DISRUPTION" status={detail.status}>{detail.confirmedOffload ? 'CONFIRMED DISRUPTION' : 'CONFIRMATION EVIDENCE MISSING'}</RecoveryStatusBadge></div>
          <div className="disruption-api-facts">
            <article><small>FLIGHT / DEPARTURE</small><strong>{detail.flight.flightId}</strong><span>{formatTimestamp(detail.flight.scheduledDeparture)}</span></article>
            <article><small>ULD / CARGO</small><strong>{detail.uld.uldType} · {detail.cargo.weightKg.toLocaleString()} kg</strong><span>{detail.cargo.volumeM3.toLocaleString()} m³ · {detail.cargo.handlingRequirements.join(', ') || 'Handling requirements unavailable'}</span></article>
            <article><small>DELIVERY COMMITMENT</small><strong>{detail.caseSummary?.deliveryCommitment ?? 'Unavailable'}</strong><span>{detail.caseSummary?.capacityConstraint ?? 'Capacity evidence unavailable'}</span></article>
            <article><small>BASELINE EXPECTED LOSS</small><strong>{formatMoney(detail.caseSummary?.baselineExpectedLoss, detail.caseSummary?.currency)}</strong><span>{detail.caseSummary?.disruption ?? 'Disruption summary unavailable'}</span></article>
          </div>
          <RecoveryDeadlineNotice commitment={detail.caseSummary?.deliveryCommitment} />
          <section className="disruption-api-evidence"><h4>Authoritative offload confirmation</h4>{detail.confirmedOffload ? <dl><div><dt>Confirmed at</dt><dd>{formatTimestamp(detail.confirmedOffload.confirmedAt)}</dd></div><div><dt>Source</dt><dd>{detail.confirmedOffload.source}</dd></div><div><dt>Source event</dt><dd>{detail.confirmedOffload.sourceEventId}</dd></div><div><dt>Reason</dt><dd>{detail.confirmedOffload.reason}</dd></div></dl> : <div className="api-state error" role="alert"><strong>Confirmation evidence missing</strong><span>The API item is typed as a disruption but did not return its required authoritative confirmation evidence. Review submission is disabled.</span></div>}</section>
          <section className="disruption-api-options"><div className="panel-heading"><div><h4>Routing options</h4><p>Feasibility and expected loss are evidence for review; no route is booked here.</p></div></div>
            {optionsLoading && <p role="status">Loading routing options…</p>}{optionsError && <div className="api-state error" role="alert"><strong>Could not load route options</strong><span>{messageFor(optionsError)}</span></div>}
            {options && options.options.length === 0 && <div className="empty-state"><strong>No routing options returned</strong><span>The API has no route candidate for this disruption.</span></div>}
            {options && options.options.length > 0 && <div className="table-wrap"><table><thead><tr><th>OPTION</th><th>ROUTE</th><th>FEASIBILITY</th><th>CAPACITY</th><th>ARRIVAL / DELAY</th><th>MODELED LOSS</th><th>EVIDENCE</th></tr></thead><tbody>{options.options.map((option) => <tr key={option.optionId} className={selectedOptionId === option.optionId ? 'recommended-row' : ''}>
              <td><strong>{option.optionType}</strong><small>{option.optionId}{options.bestOptions.includes(option.optionId) ? ' · best modeled option' : ''}</small></td>
              <td>{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to} (${leg.operatingFlightId})`).join(' · ')}</td><td>{option.feasibilityStatus}<small>{option.feasibilityPercentage}% · unknown stays unconfirmed</small></td><td>{option.capacityStatus}<small>{option.usableCapacityKg.toLocaleString()} kg usable</small></td><td>{formatTimestamp(option.expectedArrival)}<small>{option.expectedDelayMinutes} min delay</small></td><td>{formatMoney(option.totalModeledExpectedLoss, options.currency)}</td><td><button className="text-button" type="button" onClick={() => { setOptionDetail(null); setOptionDetailError(null); setSelectedOptionId(option.optionId) }}>Review evidence</button><small>{option.missingData.length ? `${option.missingData.length} outstanding item(s)` : 'No missing items reported'}</small></td>
            </tr>)}</tbody></table></div>}
            {optionDetailLoading && <p role="status">Loading selected option details…</p>}{optionDetailError && <div className="api-state error" role="alert"><strong>Could not load option detail</strong><span>{messageFor(optionDetailError)}</span></div>}
            {optionDetail && <AdditionalOptionEvidence detail={optionDetail} />}
            {optionDetail && <div className="disruption-option-detail"><div><h4>Selected option evidence · {optionDetail.option.optionId}</h4><p>{optionDetail.explanation.summary}</p><p>{optionDetail.option.networkImpact}</p></div><dl><div><dt>Cargo / customer impact</dt><dd>{formatMoney(optionDetail.costBreakdown.cargoCustomerImpact, optionDetail.costBreakdown.currency)}</dd></div><div><dt>Carrier contribution</dt><dd>{formatMoney(optionDetail.costBreakdown.cathayContributionImpact, optionDetail.costBreakdown.currency)}</dd></div><div><dt>Recovery handling</dt><dd>{formatMoney(optionDetail.costBreakdown.recoveryAndHandlingCost, optionDetail.costBreakdown.currency)}</dd></div><div><dt>Delay / service</dt><dd>{formatMoney(optionDetail.costBreakdown.delayAndServiceImpact, optionDetail.costBreakdown.currency)}</dd></div><div><dt>Downstream network</dt><dd>{formatMoney(optionDetail.costBreakdown.downstreamNetworkImpact, optionDetail.costBreakdown.currency)}</dd></div><div><dt>Total modeled expected loss</dt><dd>{formatMoney(optionDetail.costBreakdown.totalModeledExpectedLoss, optionDetail.costBreakdown.currency)}</dd></div></dl><div><strong>Assumptions</strong>{optionDetail.explanation.assumptions.length ? <ul>{optionDetail.explanation.assumptions.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No assumptions returned by the API.</p>}</div><p><strong>Outstanding evidence:</strong> {[...new Set([...optionDetail.explanation.missingData, ...optionDetail.option.missingData])].join('; ') || 'None reported'}</p>{optionDetail.explanation.reasons.length > 0 && <ul>{optionDetail.explanation.reasons.map((text) => <li key={text}>{text}</li>)}</ul>}</div>}
          </section>
          <section className="disruption-review-form"><div><h4>Record a review</h4><p>Saved to the MAWB-linked record for this ULD. This does not confirm or execute a route.</p></div>
            <div className="settings-form"><label>Review decision<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="APPROVE_FOR_REVIEW">Approve selected route for review</option><option value="REJECT_OVERRIDE">Reject / record override</option></select></label><label>Reviewer ID<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} required placeholder="Operator ID" /></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} placeholder="Explain the review decision" /></label>
              <button className="primary-button" type="button" disabled={saving || listLoading || Boolean(listError) || detailLoading || isStale || !detail.confirmedOffload || !reason.trim() || !reviewerId.trim() || (decision === 'APPROVE_FOR_REVIEW' && (!selectedOptionId || !canApprove)) || (decision === 'REJECT_OVERRIDE' && !canReject)} onClick={() => void saveReview()}>{saving ? 'Saving review…' : 'Save review'}</button>
              {isStale && <small>Refresh the queue before saving a review from stale data.</small>}{detail.workflowControl.message && <small>{detail.workflowControl.message}{detail.workflowControl.blockingWorkItemIds.length ? ` Blocking work: ${detail.workflowControl.blockingWorkItemIds.join(', ')}.` : ''}</small>}
            </div>
            {saveError && <div className="api-state error" role="alert"><strong>Review was not saved</strong><span>{messageFor(saveError)}</span>{saveError.kind === 'conflict' && <button className="text-button" type="button" onClick={refreshList}>Refresh the latest document version</button>}</div>}
          </section>
          <RecoveryReviewHistory reviews={detail.reviewHistory} title="Saved review history" />
        </>}
      </>}
      <div className="recovery-api-pagination"><span>Page {list.pagination.page} of {list.pagination.totalPages} · {list.totalItems} disruption records</span><div><button className="outline-button" type="button" disabled={listLoading || page <= 1} onClick={() => { setListLoading(true); setListError(null); setPage((value) => Math.max(1, value - 1)) }}>Previous</button><button className="outline-button" type="button" disabled={listLoading || !list.pagination.hasNextPage} onClick={() => { setListLoading(true); setListError(null); setPage((value) => value + 1) }}>Next</button></div></div>
    </>}
    <small className="api-contract-note">A review records operator intent only. Booking, allocation, capacity reservation, and offload confirmation require separate authorized operations.</small>
  </section>
}
