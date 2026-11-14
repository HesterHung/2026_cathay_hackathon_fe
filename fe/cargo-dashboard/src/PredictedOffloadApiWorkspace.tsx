import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Play, RotateCcw, Check, LoaderCircle, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from './components/ui/button'
import {
  getRecoveryOption,
  getRecoveryOptions,
  getRecoverySolution,
  listRecoverySolutions,
  confirmPredictedOffload,
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

function FlightCapacityEvidence({ summary, sourceLabel = 'Forecast service' }: { summary: FlightSummary; sourceLabel?: string }) {
  const booked = Math.max(0, summary.bookedWeightKg)
  const forecastCapacity = Math.max(0, summary.forecastCargoCapacityKg)
  const scale = Math.max(booked, forecastCapacity, 1)
  const shortfall = Math.max(0, summary.capacityShortfallKg)
  const safeWidth = Math.min(booked, forecastCapacity) / scale * 100
  const riskWidth = shortfall / scale * 100
  return <section className="predicted-capacity-evidence" aria-label={`Flight-level capacity evidence for ${summary.flightId}`}>
    <div className="predicted-capacity-heading"><div><small>{sourceLabel} · {summary.flightId} · {summary.origin} → {summary.destination}</small><strong>{shortfall > 0 ? `${shortfall.toLocaleString()} kg shortfall` : 'No shortfall reported'}</strong></div></div>
    <div className="predicted-capacity-bars">
      <div className="predicted-capacity-row"><div><span>Booked load</span><strong>{booked.toLocaleString()} kg</strong></div><div className="predicted-capacity-track predicted-load-track" aria-label={`Booked load ${booked} kilograms`}><i className="booked-safe" style={{ width: `${safeWidth}%` }} /><i className="booked-risk" style={{ width: `${riskWidth}%` }} /></div></div>
      <div className="predicted-capacity-row"><div><span>Forecast capacity</span><strong>{forecastCapacity.toLocaleString()} kg</strong></div><div className="predicted-capacity-track"><i className="forecast-capacity" style={{ width: `${forecastCapacity / scale * 100}%` }} /></div></div>
    </div>
    <div className="predicted-capacity-legend"><span><i className="legend-safe" />Within forecast capacity</span>{shortfall > 0 && <span><i className="legend-risk" />Exposed portion · {shortfall.toLocaleString()} kg</span>}</div>
    <p className="prediction-model-output">{Math.round(summary.offloadProbability * 100)}% flight offload probability <span>·</span> {summary.confidence}% model confidence <span>·</span> {summary.affectedUldCount} affected ULDs</p>
    <small className="prediction-not-confirmation">Forecast exposure only; this does not confirm which cargo will be offloaded.</small>
  </section>
}

function DemoPredictionWalkthrough({ onStarted }: { onStarted: () => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const steps = [
    { title: 'Load flight and booking data', detail: 'CX880 · HKG → LAX · 15,750 kg booked cargo', source: 'Booking snapshot', value: '15,750 kg' },
    { title: 'Apply forecast payload capacity', detail: 'Forecast capacity after fuel and route-weather inputs', source: 'Forecast model', value: '14,500 kg' },
    { title: 'Calculate capacity exposure', detail: 'Booked load is above forecast capacity', source: 'Model calculation', value: '1,250 kg shortfall' },
    { title: 'Estimate offload probability', detail: 'Flight-level model output; confidence is shown separately', source: 'Prediction model', value: '64% risk · 72% confidence' },
    { title: 'Identify exposed cargo', detail: 'PMC-67890 · 980 kg · one ULD flagged for review', source: 'Affected cargo mapping', value: '1 ULD at risk' },
  ]
  useEffect(() => {
    if (!open || step >= steps.length) return
    const timer = window.setTimeout(() => setStep((current) => current + 1), 750)
    return () => window.clearTimeout(timer)
  }, [open, step, steps.length])
  const start = () => { onStarted(); setStep(0); setOpen(true) }
  return <>
    <button type="button" className="predicted-walkthrough-button" onClick={start}><Play size={15} /> Start prediction</button>
    {createPortal(<MotionConfig reducedMotion="user"><AnimatePresence>{open && <motion.div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="prediction-walkthrough-title" initial={{ opacity: 0, y: 18, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: .22, ease: 'easeOut' }} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h2 id="prediction-walkthrough-title" className="m-0 text-lg font-semibold text-slate-950">Flight Capacity Risk Assessment</h2><p className="m-0 mt-1 text-sm text-slate-500">Illustrative walkthrough · CX880 · HKG → LAX · PMC-67890</p></div><button type="button" aria-label="Close prediction walkthrough" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.1fr_.9fr]">
          <section className="border-b border-slate-200 p-5 sm:p-6 md:border-b-0 md:border-r"><div className="mb-3 flex items-center justify-between"><h3 className="m-0 text-sm font-semibold text-slate-900">Prediction steps</h3><span className="text-xs tabular-nums text-slate-500">{Math.min(step, steps.length)} / {steps.length}</span></div><div className="divide-y divide-slate-200 border-y border-slate-200">{steps.map((item, index) => { const done = step > index; const active = step === index && step < steps.length; return <motion.article key={item.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: step >= index ? 1 : .45, x: 0 }} transition={{ duration: .25, delay: index * .04 }} className="flex gap-3 py-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-800 text-white' : active ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{done ? <Check size={14} /> : active ? <LoaderCircle className="animate-spin" size={14} /> : <span className="text-xs">{index + 1}</span>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-sm font-medium text-slate-800">{item.title}</p><small className="text-slate-400">{item.source}</small></div>{done && <p className="m-0 mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>}</div>{done && <strong className="shrink-0 self-center text-xs text-emerald-900">{item.value}</strong>}</motion.article> })}</div></section>
          <aside className="p-5 sm:p-6"><h3 className="m-0 text-sm font-semibold text-slate-900">Capacity picture</h3><p className="mt-1 text-xs text-slate-500">Booked cargo compared with forecast capacity</p><div className="mt-5 space-y-4"><div><div className="mb-1 flex justify-between text-xs"><span>Booked load</span><strong>15,750 kg</strong></div><div className="h-3 overflow-hidden rounded-sm bg-slate-100"><motion.div className="flex h-full" initial={false} animate={{ width: step >= 1 ? '100%' : '0%' }} transition={{ duration: .55 }}><span className="h-full bg-emerald-800" style={{ width: `${14500 / 15750 * 100}%` }} />{step >= 3 && <motion.span initial={{ width: 0 }} animate={{ width: `${1250 / 15750 * 100}%` }} transition={{ duration: .5 }} className="h-full bg-amber-600" />}</motion.div></div></div><div><div className="mb-1 flex justify-between text-xs"><span>Forecast capacity</span><strong>14,500 kg</strong></div><div className="h-3 overflow-hidden rounded-sm bg-slate-100"><motion.div className="h-full bg-slate-500" initial={false} animate={{ width: step >= 2 ? `${14500 / 15750 * 100}%` : '0%' }} transition={{ duration: .7 }} /></div></div></div>
            <AnimatePresence>{step >= 3 && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-l-[3px] border-amber-600 bg-amber-50 px-3 py-3"><strong className="text-sm text-amber-950">1,250 kg above capacity</strong><p className="mb-0 mt-1 text-xs leading-5 text-amber-900">The flight is flagged at 64% offload probability. PMC-67890 is exposed for operational review; this is not an automatic offload decision.</p></motion.div>}</AnimatePresence>
          </aside>
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><div className="mr-1 mb-1 flex gap-3"><Button onClick={start}><RotateCcw size={14} /> Replay</Button><Button variant="primary" onClick={() => setOpen(false)}>Done</Button></div></footer>
      </motion.section>
    </motion.div>}</AnimatePresence></MotionConfig>, document.body)}
  </>
}

export function PredictedOffloadApiWorkspace({ initialFlightId, onOpenRecovery }: { initialFlightId?: string; onOpenRecovery: (workItemId: string, flightId: string) => void }) {
  const [list, setList] = useState<RecoveryListResponse | null>(null)
  const [listError, setListError] = useState<RecoveryApiError | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [demoPredictionStarted, setDemoPredictionStarted] = useState(false)
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
  const [optionDetailRequest, setOptionDetailRequest] = useState(0)
  const [optionDetail, setOptionDetail] = useState<RecoveryOptionDetail | null>(null)
  const [optionDetailLoading, setOptionDetailLoading] = useState(false)
  const [optionDetailError, setOptionDetailError] = useState<RecoveryApiError | null>(null)
  const [decision, setDecision] = useState<'APPROVE_FOR_REVIEW' | 'REJECT_OVERRIDE'>('APPROVE_FOR_REVIEW')
  const [reviewerId, setReviewerId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingWorkItemId, setConfirmingWorkItemId] = useState<string | null>(null)
  const [confirmationError, setConfirmationError] = useState<RecoveryApiError | null>(null)
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
        setSelectedWorkItemId('')
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
      setOptionsLoading(true)
      setDetailError(null); setOptionsError(null); setSaveError(null)
      setDetail(null); setOptions(null); setSelectedOptionId(''); setOptionDetail(null); setOptionDetailError(null)
      setDetail(null); setDetailLoading(false); setDetailError(null)
      void getRecoveryOptions(workItemId, controller.signal).then((result) => {
        if (result.type !== 'PREDICTED_OFFLOAD') throw new RecoveryApiError('Route options are not for a PREDICTED_OFFLOAD record.', 'invalid-response')
        setOptions(result)
        setSelectedOptionId('')
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
  }, [selectedWorkItemId, selectedOptionId, optionDetailRequest, refreshKey])

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

  const confirmOffload = async (item: RecoveryWorkItem) => {
    if (item.type !== 'PREDICTED_OFFLOAD' || confirmingWorkItemId) return
    setConfirmingWorkItemId(item.workItemId); setConfirmationError(null)
    try {
      await confirmPredictedOffload(item.workItemId, {
        source: 'AUTHORIZED_DECISION', sourceEventId: `offload-confirmation-${crypto.randomUUID()}`,
        confirmedAt: new Date().toISOString(), reason: 'Authorized operator confirmed the predicted offload.',
        reviewerId: 'Alex Lee', documentVersion: item.document.version,
      })
      onOpenRecovery(item.workItemId, item.flight.flightId)
    } catch (error) {
      setConfirmationError(toApiError(error))
    } finally { setConfirmingWorkItemId(null) }
  }

  return <section className="panel predicted-api-workspace">
    <div className="page-heading"><div><h1>Predicted Offload</h1></div><div className="flex items-center gap-3">{!list ? <DemoPredictionWalkthrough onStarted={() => setDemoPredictionStarted(true)} /> : <button className="outline-button" type="button" disabled={listLoading} onClick={manualRefresh}>{listLoading ? 'Loading…' : 'Refresh queue'}</button>}</div></div>
    {!list && (demoPredictionStarted
      ? <RecoveryApiUnavailablePreview type="PREDICTED_OFFLOAD" />
      : <RecoveryWorkItemTable type="PREDICTED_OFFLOAD" items={[]} selectedWorkItemId="" sourceLabel="Awaiting prediction" />)}
    {listError && list && <div className="api-state error" role="alert"><strong>{listError.kind === 'authorization' ? 'Authorization required' : listError.kind === 'not-found' ? 'Recovery API endpoint is unavailable' : 'Could not refresh predicted-offload queue'}</strong><span>{apiErrorLabel(listError)}</span><small>Showing the last successful response from {timeLabel(fetchedAt)}.</small></div>}
    {confirmationError && <div className="api-state error" role="alert"><strong>Offload confirmation failed</strong><span>{apiErrorLabel(confirmationError)}</span>{confirmationError.kind === 'conflict' && <button className="text-button" type="button" onClick={refreshQueue}>Refresh latest document version</button>}</div>}
    {stale && <div className="api-state stale" role="status"><strong>Forecast queue may be stale</strong><span>The last successful response is over five minutes old. Refresh before reviewing a ULD.</span></div>}
    {savedMessage && <div className="api-state success" role="status"><strong>{savedMessage}</strong><span>The latest forecast record and review history are being reloaded.</span></div>}
    {list && <>
      {!listError && <div className="api-state success" role="status"><strong>{list.totalItems} matching predicted-offload ULD work item(s)</strong><span>{summaries.length} flight-level summary records · fetched {timeLabel(fetchedAt)} · page {list.pagination.page} of {list.pagination.totalPages}</span></div>}
      <RecoveryQueueFilterBar value={filterDraft} disabled={listLoading} onChange={setFilterDraft} onApply={() => { setPage(1); setFilters({ flightId: filterDraft.flightId.trim(), masterAirwayBillNumber: filterDraft.masterAirwayBillNumber.trim(), status: filterDraft.status.trim() }) }} onClear={() => { setFilterDraft(emptyRecoveryQueueFilters); setFilters(emptyRecoveryQueueFilters); setPage(1) }} />
      {list.items.length === 0 && <div className="empty-state"><strong>No predicted-offload ULD work items</strong><span>The API returned an empty queue. No fixture records are substituted here.</span></div>}
      {list.items.length > 0 && <RecoveryWorkItemTable type="PREDICTED_OFFLOAD" items={items} selectedWorkItemId={selectedWorkItemId} confirmingWorkItemId={confirmingWorkItemId} onConfirm={(item) => void confirmOffload(item)} />}
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
            {activeOptions && activeOptions.options.length > 0 && <div className="table-wrap"><table><thead><tr><th>OPTION</th><th>ROUTE</th><th>FEASIBILITY</th><th>CAPACITY</th><th>ARRIVAL / DELAY</th><th>MODELED LOSS</th><th>EVIDENCE</th></tr></thead><tbody>{activeOptions.options.map((option) => <tr key={option.optionId} className={selectedOptionId === option.optionId ? 'recommended-row' : ''} onClick={() => { setSelectedOptionId(option.optionId); setOptionDetail(null); setOptionDetailError(null); setOptionDetailRequest((value) => value + 1) }}><td><strong>{option.optionType}</strong><small>{option.optionId}{activeOptions.bestOptions.includes(option.optionId) ? ' · best modeled option' : ''}</small></td><td>{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to} (${leg.operatingFlightId})`).join(' · ')}</td><td>{option.feasibilityStatus}<small>{option.feasibilityPercentage}% · unknown remains unknown</small></td><td>{option.capacityStatus}<small>{kgLabel(option.usableCapacityKg)}</small></td><td>{timeLabel(option.expectedArrival)}<small>{option.expectedDelayMinutes} min delay</small></td><td>{amountLabel(option.totalModeledExpectedLoss, activeOptions.currency)}</td><td><button className="text-button" type="button" onClick={(event) => { event.stopPropagation(); setOptionDetail(null); setOptionDetailError(null); setSelectedOptionId(option.optionId); setOptionDetailRequest((value) => value + 1) }}>Review evidence</button><small>{option.missingData.length ? `${option.missingData.length} outstanding item(s)` : 'No missing data reported'}</small></td></tr>)}</tbody></table></div>}
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
