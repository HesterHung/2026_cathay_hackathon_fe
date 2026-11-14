import { Fragment, type ReactNode } from 'react'
import type { QueueType, RecoveryReview, RecoveryWorkItem, WorkflowControl } from './recoveryApi'
import { recoveryActionNames, recoveryQueueNames, recoveryStatusTone, type RecoveryQueueFilters } from './recoveryQueueUi'

interface RecoveryQueueFilterBarProps {
  value: RecoveryQueueFilters
  disabled?: boolean
  onChange: (value: RecoveryQueueFilters) => void
  onApply: () => void
  onClear: () => void
}

export function RecoveryQueueFilterBar({ value, disabled = false, onChange, onApply, onClear }: RecoveryQueueFilterBarProps) {
  const update = (key: keyof RecoveryQueueFilters, nextValue: string) => onChange({ ...value, [key]: nextValue })
  return <form className="recovery-queue-filters" onSubmit={(event) => { event.preventDefault(); onApply() }} aria-label="Filter recovery queue">
    <label>Flight<input type="search" value={value.flightId} onChange={(event) => update('flightId', event.target.value)} placeholder="Flight number" /></label>
    <label>MAWB<input type="search" value={value.masterAirwayBillNumber} onChange={(event) => update('masterAirwayBillNumber', event.target.value)} placeholder="Master airway bill" /></label>
    <label>Status<input type="search" value={value.status} onChange={(event) => update('status', event.target.value)} placeholder="Work item status" /></label>
    <div className="recovery-queue-filter-actions"><button className="primary-button" type="submit" disabled={disabled}>Apply filters</button><button className="outline-button" type="button" onClick={onClear} disabled={disabled || (!value.flightId && !value.masterAirwayBillNumber && !value.status)}>Clear</button></div>
  </form>
}

export function RecoveryWorkflowPanel({ type, queueControl, itemControl }: { type: QueueType; queueControl: WorkflowControl; itemControl?: WorkflowControl }) {
  const queueActions = queueControl.allowedActionsByType[type]
  const actions = itemControl
    ? queueActions.filter((action) => itemControl.allowedActionsByType[type].includes(action))
    : queueActions
  const blockers = [...new Set([...(queueControl.blockingWorkItemIds ?? []), ...(itemControl?.blockingWorkItemIds ?? [])])]
  const messages = [...new Set([queueControl.message, itemControl?.message].filter((message): message is string => Boolean(message)))]
  const itemPermissions = itemControl ? 'for selected ULD' : 'for this queue'
  return <section className="recovery-workflow-panel" aria-label={`${recoveryQueueNames[type]} workflow permissions`}>
    <div className="recovery-workflow-priority"><small>Active priority</small><strong>{queueControl.activePriority === null ? 'No active priority' : `Priority ${queueControl.activePriority}`}</strong></div>
    <div className="recovery-workflow-actions"><small>Permitted actions {itemPermissions}</small><div>{actions.length ? actions.map((action) => <span className="recovery-action-chip" key={action}>{recoveryActionNames[action]}</span>) : <span className="recovery-action-none">No decisions currently permitted</span>}</div></div>
    {(blockers.length > 0 || messages.length > 0) && <div className="recovery-workflow-explanation"><strong>{blockers.length ? 'Workflow gate' : 'Workflow message'}</strong>{messages.map((message) => <span key={message}>{message}</span>)}{blockers.length > 0 && <span>Blocking work: {blockers.join(', ')}</span>}</div>}
  </section>
}

function reviewEvidence(review: RecoveryReview): ReactNode {
  const refs = [review.optionId ? `Option ${review.optionId}` : null, review.targetWorkItemId ? `Target ${review.targetWorkItemId}` : null, review.confirmedNoShowEventId ? `No-show event ${review.confirmedNoShowEventId}` : null].filter(Boolean)
  return refs.length ? refs.join(' · ') : '—'
}

export function RecoveryReviewHistory({ reviews, title = 'Saved decision history' }: { reviews: RecoveryReview[]; title?: string }) {
  return <section className="disruption-review-history recovery-shared-history"><h4>{title}</h4>{reviews.length ? <div className="table-wrap"><table><thead><tr><th>DECISION</th><th>REVIEWER</th><th>REASON</th><th>RELATED EVIDENCE</th><th>REVIEWED</th><th>VERSION</th><th>DECISION ID</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.decisionId}><td>{recoveryActionNames[review.decision]} ({review.decision})</td><td>{review.reviewerId}</td><td>{review.reason}</td><td>{reviewEvidence(review)}</td><td>{new Date(review.reviewedAt).toLocaleString()}</td><td>{review.documentVersion}</td><td>{review.decisionId}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No saved decisions</strong><span>API review history is scoped to this ULD. A review does not execute a route or allocation.</span></div>}</section>
}

export function RecoveryStatusBadge({ type, status, children }: { type: QueueType; status: string; children?: ReactNode }) {
  return <span className={`status-pill ${recoveryStatusTone(type, status)}`}>{children ?? status.replaceAll('_', ' ')}</span>
}

export function RecoveryDeadlineNotice({ commitment }: { commitment?: string | null }) {
  return <aside className="recovery-deadline-notice" aria-label="Operational deadline availability">
    <strong>Operational deadline not provided by the API</strong>
    <span>{commitment ? `Delivery commitment supplied by the API: ${commitment}. This summary is not treated as a timestamp.` : 'The recovery-solutions contract has no separate operational-deadline field for this item.'}</span>
  </aside>
}

export function RecoveryWorkItemTable({ type, items, selectedWorkItemId, onSelect, onOpenRecovery, onConfirm, confirmingWorkItemId, sourceLabel = 'Live API data' }: {
  type: QueueType
  items: RecoveryWorkItem[]
  selectedWorkItemId: string
  onSelect?: (item: RecoveryWorkItem) => void
  onOpenRecovery?: (workItemId: string, flightId: string) => void
  onConfirm?: (item: RecoveryWorkItem) => void
  confirmingWorkItemId?: string | null
  sourceLabel?: string
}) {
  const groups = new Map<string, RecoveryWorkItem[]>()
  for (const item of items) {
    const group = groups.get(item.masterAirwayBill.number) ?? []
    group.push(item)
    groups.set(item.masterAirwayBill.number, group)
  }
  const groupedItems = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  const displayTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Unavailable'
  return <section className="recovery-work-item-table" aria-label={`${recoveryQueueNames[type]} API work items`}>
    <div className="recovery-work-item-table-heading"><div><h3>Recovery work items</h3></div><span className="recovery-data-source">{sourceLabel}</span></div>
    <div className="table-wrap"><table><thead><tr><th scope="col">FLIGHT</th><th scope="col">FLIGHT DATE</th><th scope="col">ULD</th><th scope="col">STATUS</th><th scope="col">CARGO WEIGHT</th><th scope="col">VOLUME</th><th scope="col">DELIVERY COMMITMENT</th><th scope="col">LAST UPDATED</th>{onConfirm && <th scope="col">ACTION</th>}</tr></thead><tbody>
      {groupedItems.map(([mawbNumber, group]) => <Fragment key={mawbNumber}>
        <tr className="recovery-mawb-group"><th colSpan={onConfirm ? 9 : 8} scope="rowgroup"><span>MAWB {group[0].masterAirwayBill.displayLabel}</span><small>{group.length} ULD {group.length === 1 ? 'record' : 'records'}</small></th></tr>
        {group.map((item) => <tr key={item.workItemId} tabIndex={onOpenRecovery && type !== 'PREDICTED_OFFLOAD' ? 0 : undefined} aria-label={onOpenRecovery && type !== 'PREDICTED_OFFLOAD' ? `Open recovery for ${item.flight.flightId}, ULD ${item.uld.uldId}` : undefined} className={`${selectedWorkItemId === item.workItemId ? 'selected ' : ''}${onOpenRecovery && type !== 'PREDICTED_OFFLOAD' ? 'recovery-work-item-clickable' : ''}`} onClick={() => { if (type !== 'PREDICTED_OFFLOAD') { onSelect?.(item); onOpenRecovery?.(item.workItemId, item.flight.flightId) } }} onKeyDown={(event) => { if (type !== 'PREDICTED_OFFLOAD' && onOpenRecovery && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect?.(item); onOpenRecovery(item.workItemId, item.flight.flightId) } }}>
          <td data-label="FLIGHT"><strong>{item.flight.flightId.split('-')[0]}</strong></td>
          <td data-label="FLIGHT DATE">{item.flight.flightId.split('-')[1] ?? 'Unavailable'}</td>
          <td data-label="ULD"><strong>{item.uld.uldId.slice(0, 3)}-{item.uld.uldId.slice(3, 8)}</strong></td>
          <td data-label="STATUS"><RecoveryStatusBadge type={type} status={item.pool?.disposition ?? item.status} /></td>
          <td data-label="CARGO WEIGHT">{item.cargo.weightKg.toLocaleString()} kg</td>
          <td data-label="VOLUME">{item.cargo.volumeM3.toLocaleString()} m³</td>
          <td data-label="DELIVERY COMMITMENT">{item.caseSummary?.deliveryCommitment ?? 'Unavailable'}</td>
          <td data-label="LAST UPDATED">{displayTime(item.document.updatedAt)}</td>
          {onConfirm && <td data-label="ACTION"><button className="primary-button" type="button" disabled={Boolean(confirmingWorkItemId)} onClick={() => onConfirm(item)}>{confirmingWorkItemId === item.workItemId ? 'Confirming…' : 'Confirm'}</button></td>}
        </tr>)}
      </Fragment>)}
    </tbody></table></div>
  </section>
}

const unavailableExamples: Record<QueueType, { mawb: string; flightId: string; origin: string; destination: string; uldId: string; uldType: string; statusCode: string; statusLabel: string; weightKg: number; volumeM3: number; commitment: string; updatedAt: string }> = {
  DISRUPTION: {
    mawb: '160-12345675', flightId: 'CX251', origin: 'HKG', destination: 'LHR', uldId: 'AKE12345CX', uldType: 'AKE',
    statusCode: 'RECOVERY_REQUIRED', statusLabel: 'Disruption', weightKg: 1250, volumeM3: 4.2,
    commitment: '10 Nov, 18:00', updatedAt: '10 Nov, 09:30',
  },
  PREDICTED_OFFLOAD: {
    mawb: '160-98765432', flightId: 'CX880', origin: 'SFO', destination: 'HKG', uldId: 'PMC67890CX', uldType: 'PMC',
    statusCode: 'PREDICTED_OFFLOAD', statusLabel: 'Predicted · not confirmed', weightKg: 980, volumeM3: 5.1,
    commitment: '11 Nov, 12:00', updatedAt: '10 Nov, 08:45',
  },
  PENDING_POOL: {
    mawb: '160-24681357', flightId: 'CX282', origin: 'HKG', destination: 'LHR', uldId: 'AKE24680CX', uldType: 'AKE',
    statusCode: 'PRIORITY_HOLD', statusLabel: 'On hold · eligibility unknown', weightKg: 860, volumeM3: 5.2,
    commitment: '10 Nov, 18:00', updatedAt: '10 Nov, 09:12',
  },
}

export function RecoveryApiUnavailablePreview({ type, onOpenRecovery }: { type: QueueType; onOpenRecovery?: (workItemId: string, flightId: string) => void }) {
  const example = unavailableExamples[type]
  const item: RecoveryWorkItem = {
    workItemId: `demo-${type.toLowerCase()}`, type, status: example.statusCode, predictionUnit: 'ULD',
    uld: { uldId: example.uldId, uldType: example.uldType, weightKg: example.weightKg, volumeM3: example.volumeM3, origin: example.origin, destination: example.destination },
    masterAirwayBill: { number: example.mawb, documentId: `demo-mawb-${type.toLowerCase()}`, displayLabel: example.mawb },
    flight: { flightId: example.flightId, origin: example.origin, destination: example.destination, scheduledDeparture: null, aircraftType: null },
    cargo: { shipmentIds: [], weightKg: example.weightKg, volumeM3: example.volumeM3, handlingRequirements: [], commodity: null, valueAtRisk: null, currency: null },
    document: { documentId: `demo-document-${type.toLowerCase()}`, version: 1, updatedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(), caseSummary: { disruption: 'Demo disruption', capacityConstraint: 'Demo constraint', deliveryCommitment: example.commitment, baselineExpectedLoss: 0, currency: 'USD' },
    ...(type === 'PENDING_POOL' ? { pool: { source: 'DOMINO_OFFLOAD' as const, sourceFlightId: example.flightId, eligibleForNoShowReplacement: false, priorityHold: true, disposition: 'PRIORITY_HOLD' as const } } : {}),
  }
  return <RecoveryWorkItemTable type={type} items={[item]} selectedWorkItemId="" sourceLabel="Demo data · API unavailable" onOpenRecovery={onOpenRecovery} />
}
