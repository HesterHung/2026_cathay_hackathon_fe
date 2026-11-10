import type { QueueType, RecoveryDecision, RecoveryListQuery, WorkflowControl } from './recoveryApi'

export interface RecoveryQueueFilters {
  flightId: string
  masterAirwayBillNumber: string
  status: string
}

export const emptyRecoveryQueueFilters: RecoveryQueueFilters = {
  flightId: '',
  masterAirwayBillNumber: '',
  status: '',
}

export function recoveryFilterQuery(filters: RecoveryQueueFilters): Pick<RecoveryListQuery, 'flightId' | 'masterAirwayBillNumber' | 'status'> {
  const flightId = filters.flightId.trim()
  const masterAirwayBillNumber = filters.masterAirwayBillNumber.trim()
  const status = filters.status.trim()
  return {
    ...(flightId ? { flightId } : {}),
    ...(masterAirwayBillNumber ? { masterAirwayBillNumber } : {}),
    ...(status ? { status } : {}),
  }
}

export const recoveryActionNames: Record<RecoveryDecision, string> = {
  APPROVE_FOR_REVIEW: 'Approve route review',
  REJECT_OVERRIDE: 'Reject / override',
  HOLD_FOR_PRIORITY: 'Hold for priority',
  RELEASE_HOLD: 'Release hold',
  CONSIDER_FOR_NO_SHOW: 'Consider for confirmed no-show',
  CLEAR_NO_SHOW_REVIEW: 'Clear no-show review',
}

export const recoveryQueueNames: Record<QueueType, string> = {
  DISRUPTION: 'Disruption Alerts',
  PREDICTED_OFFLOAD: 'Predicted Offload',
  PENDING_POOL: 'Pending Pool',
}

export function isQueueDecisionAllowed(
  queueControl: WorkflowControl | undefined,
  itemControl: WorkflowControl | undefined,
  type: QueueType,
  decision: RecoveryDecision,
): boolean {
  return Boolean(queueControl?.allowedActionsByType[type].includes(decision) && itemControl?.allowedActionsByType[type].includes(decision))
}

export function recoveryStatusTone(type: QueueType, status: string): string {
  const terminalStatuses: Record<QueueType, string[]> = {
    DISRUPTION: ['RECOVERED', 'CLOSED'],
    PREDICTED_OFFLOAD: ['CLEARED', 'CLOSED'],
    PENDING_POOL: ['RETIRED'],
  }
  if (terminalStatuses[type].includes(status) || (type === 'PENDING_POOL' && status === 'AVAILABLE')) return 'status-good'
  if (type === 'DISRUPTION' && status === 'RECOVERY_REQUIRED') return 'status-bad'
  if (['REVIEWED', 'PRIORITY_HOLD', 'NO_SHOW_REVIEW', 'PREVENTIVE_ACTION_REQUIRED'].includes(status)) return 'status-pending'
  return 'status-caution'
}
