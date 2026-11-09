import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getRecoverySolution,
  getReplacementCandidates,
  listRecoverySolutions,
  RecoveryApiError,
  saveRecoveryDecision,
  type RecoveryDetail,
  type RecoveryListResponse,
  type RecoveryWorkItem,
  type ReplacementCandidate,
  type ReplacementCandidatesResponse,
  type RecoveryDecision,
} from './recoveryApi'

type PoolAction = Extract<RecoveryDecision, 'HOLD_FOR_PRIORITY' | 'RELEASE_HOLD' | 'CONSIDER_FOR_NO_SHOW' | 'CLEAR_NO_SHOW_REVIEW'>
type EvaluationPurpose = 'PRIORITY_ALTERNATIVE' | 'NO_SHOW_REPLACEMENT'

function apiError(error: unknown): RecoveryApiError {
  return error instanceof RecoveryApiError ? error : new RecoveryApiError(error instanceof Error ? error.message : 'Unexpected API error.', 'http')
}

function errorHeading(error: RecoveryApiError): string {
  const labels: Record<RecoveryApiError['kind'], string> = {
    network: 'Recovery API is unreachable', authorization: 'Authorization required', 'not-found': 'Recovery API endpoint or record not found',
    validation: 'Request validation failed', conflict: 'Record changed; refresh before retrying', gated: 'Action gated by workflow priority',
    server: 'Recovery API server error', http: 'Recovery API request failed', 'invalid-response': 'Recovery API returned an invalid response',
  }
  return labels[error.kind]
}

function asCandidates(response: ReplacementCandidatesResponse): ReplacementCandidate[] {
  const candidates = Array.isArray(response) ? response : response.candidates
  if (!Array.isArray(candidates) || !candidates.every((candidate) =>
    candidate && typeof candidate.candidateWorkItemId === 'string' && typeof candidate.targetWorkItemId === 'string' &&
    ['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN'].includes(candidate.eligibility) &&
    Array.isArray(candidate.reasons) && candidate.reasons.every((reason) => typeof reason === 'string') &&
    Array.isArray(candidate.missingData) && candidate.missingData.every((item) => typeof item === 'string') &&
    (typeof candidate.routeCompatible === 'boolean' || candidate.routeCompatible === null) &&
    (typeof candidate.handlingCompatible === 'boolean' || candidate.handlingCompatible === null) &&
    (typeof candidate.weightCapacityAvailableKg === 'number' && Number.isFinite(candidate.weightCapacityAvailableKg) || candidate.weightCapacityAvailableKg === null) &&
    (typeof candidate.volumeCapacityAvailableM3 === 'number' && Number.isFinite(candidate.volumeCapacityAvailableM3) || candidate.volumeCapacityAvailableM3 === null) &&
    typeof candidate.requiresConfirmedNoShow === 'boolean')) {
    throw new RecoveryApiError('The candidate endpoint returned data that does not match the replacement-candidate contract.', 'invalid-response')
  }
  return candidates
}

function formattedTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : 'Unavailable'
}

function isActiveTarget(item: RecoveryWorkItem): boolean {
  if (item.type === 'DISRUPTION') return !['RECOVERED', 'CLOSED'].includes(item.status)
  if (item.type === 'PREDICTED_OFFLOAD') return !['CLEARED', 'CLOSED'].includes(item.status)
  return false
}

async function listActiveTargetItems(type: 'DISRUPTION' | 'PREDICTED_OFFLOAD', signal: AbortSignal): Promise<RecoveryWorkItem[]> {
  const first = await listRecoverySolutions({ type, page: 1, limit: 100 }, signal)
  const items = [...first.items]
  for (let nextPage = 2; nextPage <= first.pagination.totalPages; nextPage += 1) {
    const response = await listRecoverySolutions({ type, page: nextPage, limit: 100 }, signal)
    items.push(...response.items)
  }
  return items.filter(isActiveTarget)
}

export function PendingPoolApiWorkspace({ initialFlightId }: { initialFlightId?: string }) {
  const [pool, setPool] = useState<RecoveryListResponse | null>(null)
  const [targets, setTargets] = useState<RecoveryWorkItem[]>([])
  const [targetError, setTargetError] = useState<RecoveryApiError | null>(null)
  const [queueError, setQueueError] = useState<RecoveryApiError | null>(null)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueCheckedAt, setQueueCheckedAt] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [now, setNow] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<RecoveryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<RecoveryApiError | null>(null)
  const [targetId, setTargetId] = useState('')
  const [eventId, setEventId] = useState('')
  const [purpose, setPurpose] = useState<EvaluationPurpose>('PRIORITY_ALTERNATIVE')
  const [evaluationRequest, setEvaluationRequest] = useState<{ candidateId: string; targetId: string; purpose: EvaluationPurpose; eventId: string; serial: number } | null>(null)
  const [evaluatedFor, setEvaluatedFor] = useState<{ candidateId: string; targetId: string; purpose: EvaluationPurpose; eventId: string } | null>(null)
  const [candidateResult, setCandidateResult] = useState<ReplacementCandidate | null>(null)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState<RecoveryApiError | null>(null)
  const [action, setAction] = useState<PoolAction>('HOLD_FOR_PRIORITY')
  const [reviewerId, setReviewerId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<RecoveryApiError | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setQueueLoading(true)
    setQueueError(null)
    setRefreshKey((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setQueueLoading(true)
      setQueueError(null)
      void Promise.allSettled([
        listRecoverySolutions({ type: 'PENDING_POOL', page, limit: 100 }, controller.signal),
        listActiveTargetItems('DISRUPTION', controller.signal),
        listActiveTargetItems('PREDICTED_OFFLOAD', controller.signal),
      ]).then(([poolResponse, disruptionResponse, predictionResponse]) => {
        if (poolResponse.status === 'rejected') throw poolResponse.reason
        const poolResult = poolResponse.value
        setPool(poolResult)
        const nextTargets = [
          ...(disruptionResponse.status === 'fulfilled' ? disruptionResponse.value : []),
          ...(predictionResponse.status === 'fulfilled' ? predictionResponse.value : []),
        ]
        setTargets(nextTargets)
        setTargetError(disruptionResponse.status === 'rejected' || predictionResponse.status === 'rejected'
          ? apiError(disruptionResponse.status === 'rejected' ? disruptionResponse.reason : predictionResponse.status === 'rejected' ? predictionResponse.reason : undefined)
          : null)
        setQueueCheckedAt(new Date().toISOString())
        setSelectedId((current) => poolResult.items.some((item) => item.workItemId === current) ? current : poolResult.items[0]?.workItemId ?? '')
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setQueueError(apiError(error))
      }).finally(() => { if (!controller.signal.aborted) setQueueLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [page, refreshKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    const workItemId = selectedId
    const timer = window.setTimeout(() => {
      setDetailLoading(true)
      setDetailError(null)
      setDetail(null)
      setEvaluatedFor(null)
      setCandidateResult(null)
      setCandidateError(null)
      void getRecoverySolution(workItemId, controller.signal).then((result) => {
        if (result.type !== 'PENDING_POOL' || !result.pool) throw new RecoveryApiError('Selected record is not a PENDING_POOL item or is missing pool eligibility data.', 'invalid-response')
        setDetail(result)
        setAction(result.pool.priorityHold ? 'RELEASE_HOLD' : result.pool.disposition === 'NO_SHOW_REVIEW' ? 'CLEAR_NO_SHOW_REVIEW' : 'HOLD_FOR_PRIORITY')
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setDetailError(apiError(error))
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selectedId, refreshKey])

  useEffect(() => {
    if (!evaluationRequest) return
    const controller = new AbortController()
    const { candidateId: requestCandidateId, targetId: requestTargetId, purpose: requestPurpose, eventId: requestEventId } = evaluationRequest
    const timer = window.setTimeout(() => {
      setCandidateLoading(true)
      setCandidateError(null)
      setCandidateResult(null)
      setEvaluatedFor(null)
      void getReplacementCandidates(requestCandidateId, {
        targetWorkItemId: requestTargetId,
        purpose: requestPurpose,
        ...(requestPurpose === 'NO_SHOW_REPLACEMENT' ? { confirmedNoShowEventId: requestEventId } : {}),
      }, controller.signal).then((response) => {
        const result = asCandidates(response).find((candidate) => candidate.candidateWorkItemId === requestCandidateId && candidate.targetWorkItemId === requestTargetId)
        if (!result) throw new RecoveryApiError('Candidate evaluation did not include the selected pool item and target.', 'invalid-response')
        setCandidateResult(result)
        setEvaluatedFor({ candidateId: requestCandidateId, targetId: requestTargetId, purpose: requestPurpose, eventId: requestEventId })
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setCandidateError(apiError(error))
      }).finally(() => { if (!controller.signal.aborted) setCandidateLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [evaluationRequest])

  const items = pool?.items ?? []
  const current = detail?.workItemId === selectedId ? detail : null
  const selectedTarget = targets.find((item) => item.workItemId === targetId)
  const queueWorkflow = pool?.workflowControl
  const allowed = (decision: PoolAction) => Boolean(queueWorkflow?.allowedActionsByType.PENDING_POOL.includes(decision) && current?.workflowControl.allowedActionsByType.PENDING_POOL.includes(decision))
  const evaluatedMatches = Boolean(evaluatedFor && current && evaluatedFor.candidateId === current.workItemId && evaluatedFor.targetId === targetId && evaluatedFor.purpose === purpose && evaluatedFor.eventId === (purpose === 'NO_SHOW_REPLACEMENT' ? eventId.trim() : ''))
  const noShowReady = Boolean(purpose === 'NO_SHOW_REPLACEMENT' && evaluatedMatches && candidateResult?.eligibility === 'ELIGIBLE' && candidateResult.missingData.length === 0 && selectedTarget && isActiveTarget(selectedTarget))
  const canSaveAction = action === 'HOLD_FOR_PRIORITY' || action === 'RELEASE_HOLD'
    ? allowed(action)
    : action === 'CLEAR_NO_SHOW_REVIEW' ? allowed(action)
      : allowed(action) && noShowReady
  const stale = Boolean(queueCheckedAt && now - Date.parse(queueCheckedAt) > 5 * 60 * 1000)
  const gated = Boolean(queueWorkflow && (queueWorkflow.activePriority === 1 || queueWorkflow.activePriority === 2) && (!queueWorkflow.allowedActionsByType.PENDING_POOL.length || (!allowed('HOLD_FOR_PRIORITY') && !allowed('RELEASE_HOLD'))))

  useEffect(() => {
    if (targets.some((item) => item.workItemId === targetId)) return
    const first = targets.find((item) => item.flight.flightId === initialFlightId) ?? targets[0]
    const timer = window.setTimeout(() => setTargetId(first?.workItemId ?? ''), 0)
    return () => window.clearTimeout(timer)
  }, [targetId, targets, initialFlightId])

  const startCandidateEvaluation = () => {
    setSavedMessage(null)
    setCandidateError(null)
    setEvaluationRequest((currentRequest) => ({ candidateId: selectedId, targetId, purpose, eventId: purpose === 'NO_SHOW_REPLACEMENT' ? eventId.trim() : '', serial: (currentRequest?.serial ?? 0) + 1 }))
  }

  const submitDecision = async () => {
    if (!current || !canSaveAction || !reviewerId.trim() || !reason.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveRecoveryDecision(current.workItemId, {
        type: 'PENDING_POOL', uldId: current.uld.uldId,
        masterAirwayBillNumber: current.masterAirwayBill.number,
        documentVersion: current.document.version,
        optionId: null,
        ...(action === 'CONSIDER_FOR_NO_SHOW' ? { targetWorkItemId: targetId, confirmedNoShowEventId: eventId.trim() } : {}),
        decision: action, reason: reason.trim(), reviewerId: reviewerId.trim(), reviewedAt: new Date().toISOString(),
      })
      setReason('')
      setSavedMessage(`${action.replaceAll('_', ' ')} review saved. The candidate remains in the pending pool; no cargo was assigned or reserved.`)
      refresh()
    } catch (error) {
      setSaveError(apiError(error))
    } finally { setSaving(false) }
  }

  const noShowActionRequired = useMemo(() => action === 'CONSIDER_FOR_NO_SHOW' && !noShowReady, [action, noShowReady])

  return <section className="panel pending-api-workspace">
    <div className="panel-heading"><div><h2>Pending Pool · live recovery work</h2><p>Inspect API pool inventory, protect it for active priority work, and evaluate candidates against a live target.</p></div><button className="outline-button" type="button" disabled={queueLoading} onClick={() => { setSavedMessage(null); refresh() }}>{queueLoading ? 'Loading…' : 'Refresh queue'}</button></div>
    {queueLoading && !pool && <div className="empty-state" role="status"><strong>Loading pending-pool candidates</strong><span>Fetching pool inventory and active priority targets from the recovery API.</span></div>}
    {queueError && <div className="api-state error" role="alert"><strong>{errorHeading(queueError)}</strong><span>{queueError.message}</span>{pool && <small>Showing the last successful pool response from {formattedTime(queueCheckedAt)}.</small>}</div>}
    {stale && <div className="api-state stale" role="status"><strong>Pool data may be stale</strong><span>Refresh the queue before recording a decision.</span></div>}
    {savedMessage && <div className="api-state success" role="status"><strong>{savedMessage}</strong><span>Refreshing candidate detail and saved review history.</span></div>}
    {gated && <div className="api-state stale" role="status"><strong>Priority workflow restrictions apply</strong><span>{queueWorkflow?.message ?? 'Some pool actions are unavailable while higher-priority work is active.'} {queueWorkflow?.blockingWorkItemIds.length ? `Blocking work: ${queueWorkflow.blockingWorkItemIds.join(', ')}.` : ''} Candidate records remain available for inspection, and actions are enabled only when the API permits them.</span></div>}
    {pool && <>
      {!queueError && <div className="api-state success" role="status"><strong>{pool.totalItems} pending-pool record(s)</strong><span>Active priority {queueWorkflow?.activePriority ?? 'none'} · loaded {formattedTime(queueCheckedAt)}{queueWorkflow?.message ? ` · ${queueWorkflow.message}` : ''}</span></div>}
      {items.length === 0 ? <div className="empty-state"><strong>No pending-pool candidates</strong><span>The API returned an empty page. No demo candidates are substituted.</span></div> : <div className="pending-api-layout">
        <nav className="pending-api-candidate-list" aria-label="Pending pool candidates">{items.map((item) => <button key={item.workItemId} type="button" className={selectedId === item.workItemId ? 'selected' : ''} onClick={() => { setSelectedId(item.workItemId); setSavedMessage(null); setSaveError(null); setEvaluatedFor(null); setCandidateResult(null) }}><strong>{item.uld.uldId}</strong><span>{item.flight.flightId} · {item.masterAirwayBill.displayLabel}</span><small>{item.pool?.disposition ?? item.status} · {item.cargo.weightKg.toLocaleString()} kg</small></button>)}</nav>
        <div className="pending-api-detail">
          {detailLoading && <div className="empty-state" role="status"><strong>Loading candidate detail</strong><span>Reading the current disposition and ULD review history.</span></div>}
          {detailError && <div className="api-state error" role="alert"><strong>Could not load pool candidate detail</strong><span>{errorHeading(detailError)}: {detailError.message}</span></div>}
          {current && <>
            <header className="pending-api-detail-head"><div><p className="eyebrow">PENDING POOL · {current.status}</p><h3>{current.uld.uldId} · {current.masterAirwayBill.displayLabel}</h3><p>{current.flight.flightId} · {current.flight.origin} → {current.flight.destination} · source {current.pool?.sourceFlightId ?? current.flight.flightId}</p></div><span className={`status-pill ${current.pool?.priorityHold ? 'status-pending' : 'status-complete'}`}>{current.pool?.disposition ?? 'DISPOSITION UNAVAILABLE'}</span></header>
            <div className="pending-api-facts"><article><small>ULD / WEIGHT</small><strong>{current.uld.uldType} · {current.uld.weightKg.toLocaleString()} kg</strong><span>Volume {current.uld.volumeM3.toLocaleString()} m³</span></article><article><small>CARGO</small><strong>{current.cargo.commodity ?? 'Commodity unavailable'}</strong><span>{current.cargo.weightKg.toLocaleString()} kg · {current.cargo.volumeM3.toLocaleString()} m³</span></article><article><small>NO-SHOW CAPABILITY</small><strong>{current.pool?.eligibleForNoShowReplacement ? 'Potentially eligible' : 'Not eligible'}</strong><span>This flag is not proof of a confirmed no-show or compatibility.</span></article><article><small>CURRENT DISPOSITION</small><strong>{current.pool?.disposition ?? 'Unavailable'}</strong><span>{current.pool?.lastDispositionAt ? `Last changed ${formattedTime(current.pool.lastDispositionAt)}` : `Priority hold: ${current.pool?.priorityHold ? 'yes' : 'no'}`}</span></article><article><small>SHIPMENTS / HANDLING</small><strong>{current.cargo.shipmentIds.length ? current.cargo.shipmentIds.join(', ') : 'Shipment IDs unavailable'}</strong><span>{current.cargo.handlingRequirements.join(', ') || 'No handling requirements supplied'}</span></article><article><small>DOCUMENT</small><strong>Version {current.document.version}</strong><span>Updated {formattedTime(current.document.updatedAt)}</span></article></div>
            <section className="pending-api-evaluation"><h4>Evaluate against an active priority target</h4><p>Candidate checks report compatibility only. They do not assign or reserve this ULD.</p>
              {targets.length ? <div className="pending-api-eval-controls"><label>Active disruption or predicted-offload ULD<select value={targetId} onChange={(event) => { setTargetId(event.target.value); setEvaluatedFor(null); setCandidateResult(null) }}>{targets.map((target) => <option key={target.workItemId} value={target.workItemId}>Priority {target.type === 'DISRUPTION' ? '1' : '2'} · {target.flight.flightId} · {target.uld.uldId} · {target.status}</option>)}</select></label><label>Evaluation purpose<select value={purpose} onChange={(event) => { setPurpose(event.target.value as EvaluationPurpose); setEvaluatedFor(null); setCandidateResult(null) }}><option value="PRIORITY_ALTERNATIVE">Priority alternative</option><option value="NO_SHOW_REPLACEMENT">Confirmed no-show replacement</option></select></label>{purpose === 'NO_SHOW_REPLACEMENT' && <label>Confirmed no-show event ID<input value={eventId} onChange={(event) => { setEventId(event.target.value); setEvaluatedFor(null); setCandidateResult(null) }} placeholder="Authoritative event ID" /></label>}<button className="outline-button" type="button" disabled={!selectedTarget || candidateLoading || (purpose === 'NO_SHOW_REPLACEMENT' && !eventId.trim())} onClick={startCandidateEvaluation}>{candidateLoading ? 'Evaluating…' : purpose === 'NO_SHOW_REPLACEMENT' ? 'Validate event and evaluate' : 'Evaluate candidate'}</button></div> : <div className="empty-state"><strong>No active priority target is available</strong><span>Candidate evaluation requires an active disruption or predicted-offload ULD from the API.</span></div>}
              {targetError && <div className="api-state error" role="alert"><strong>Could not load all active priority targets</strong><span>{targetError.message} Available API targets remain selectable.</span></div>}
              {candidateError && <div className="api-state error" role="alert"><strong>{errorHeading(candidateError)}</strong><span>{candidateError.message}</span></div>}
              {candidateLoading && <p role="status">Checking candidate compatibility against the selected target…</p>}
              {evaluatedMatches && candidateResult && <div className={`pending-api-candidate-result ${candidateResult.eligibility.toLowerCase()}`}><strong>{candidateResult.eligibility} · compatibility evaluation</strong>{purpose === 'NO_SHOW_REPLACEMENT' && <p className="pending-api-server-validation">The API returned this result for event {evaluatedFor?.eventId} and target {selectedTarget?.uld.uldId}. The backend must validate the event source, target flight, original booked ULD, and confirmation time against its authoritative event source.</p>}<p>{candidateResult.reasons.join('; ') || 'No reasons supplied by the API.'}</p><dl><div><dt>Route compatible</dt><dd>{candidateResult.routeCompatible === null ? 'Unknown' : candidateResult.routeCompatible ? 'Yes' : 'No'}</dd></div><div><dt>Handling compatible</dt><dd>{candidateResult.handlingCompatible === null ? 'Unknown' : candidateResult.handlingCompatible ? 'Yes' : 'No'}</dd></div><div><dt>Weight capacity available</dt><dd>{candidateResult.weightCapacityAvailableKg === null ? 'Unknown' : `${candidateResult.weightCapacityAvailableKg.toLocaleString()} kg`}</dd></div><div><dt>Volume capacity available</dt><dd>{candidateResult.volumeCapacityAvailableM3 === null ? 'Unknown' : `${candidateResult.volumeCapacityAvailableM3.toLocaleString()} m³`}</dd></div><div><dt>Confirmed no-show required</dt><dd>{candidateResult.requiresConfirmedNoShow ? 'Yes' : 'No'}</dd></div></dl>{candidateResult.missingData.length > 0 && <p><strong>Missing evidence:</strong> {candidateResult.missingData.join('; ')}</p>}<small>Eligibility is an API evaluation result, not an assignment.</small></div>}
            </section>
            <section className="pending-api-decision"><h4>Record a pool review</h4><p>Hold and no-show review decisions are audited to this ULD and MAWB. They do not allocate cargo.</p><div className="pending-api-decision-form"><label>Decision<select value={action} onChange={(event) => setAction(event.target.value as PoolAction)}><option value="HOLD_FOR_PRIORITY">Hold for priority review</option><option value="RELEASE_HOLD">Release priority hold</option><option value="CONSIDER_FOR_NO_SHOW">Consider for confirmed no-show</option><option value="CLEAR_NO_SHOW_REVIEW">Clear no-show review</option></select></label><label>Reviewer ID<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} placeholder="Operator ID" required /></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Explain this review decision" required /></label><button className="primary-button" type="button" disabled={saving || queueLoading || Boolean(queueError) || stale || !current || !allowed(action) || !canSaveAction || !reviewerId.trim() || !reason.trim()} onClick={() => void submitDecision()}>{saving ? 'Saving review…' : 'Save review'}</button>{!allowed(action) && <small>The selected action is not allowed by both the queue and candidate detail workflow responses. Candidate inspection remains available.</small>}{noShowActionRequired && <small>No-show review requires a fresh ELIGIBLE result for this candidate, active target, and confirmed event ID.</small>}</div>
              {saveError && <div className="api-state error" role="alert"><strong>Decision was not saved</strong><span>{errorHeading(saveError)}: {saveError.message}{saveError.details === undefined ? '' : ` ${JSON.stringify(saveError.details)}`}</span>{saveError.kind === 'conflict' && <button className="text-button" type="button" onClick={refresh}>Refresh latest document version</button>}</div>}
            </section>
            <section className="disruption-review-history"><h4>Saved pool review history</h4>{current.reviewHistory.length ? <div className="table-wrap"><table><thead><tr><th>DECISION</th><th>TARGET</th><th>NO-SHOW EVENT</th><th>REVIEWER</th><th>REASON</th><th>REVIEWED</th><th>VERSION</th></tr></thead><tbody>{current.reviewHistory.map((review) => <tr key={review.decisionId}><td>{review.decision}</td><td>{review.targetWorkItemId ?? '—'}</td><td>{review.confirmedNoShowEventId ?? '—'}</td><td>{review.reviewerId}</td><td>{review.reason}</td><td>{formattedTime(review.reviewedAt)}</td><td>{review.documentVersion}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No saved pool reviews</strong><span>Reviews are stored per ULD. A decision does not book, assign, or reserve capacity.</span></div>}</section>
          </>}
        </div>
      </div>}
      <div className="recovery-api-pagination"><span>Page {pool.pagination.page} of {pool.pagination.totalPages} · {pool.totalItems} pool candidates</span><div><button className="outline-button" type="button" disabled={queueLoading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="outline-button" type="button" disabled={queueLoading || !pool.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    </>}
    <small className="api-contract-note">This workflow evaluates and records reviews only. Actual substitution requires a separate authorized allocation and confirmation flow.</small>
  </section>
}
