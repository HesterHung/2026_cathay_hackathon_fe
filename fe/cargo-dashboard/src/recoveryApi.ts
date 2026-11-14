export type QueueType = 'DISRUPTION' | 'PREDICTED_OFFLOAD' | 'PENDING_POOL'
export type RecoveryDecision = 'APPROVE_FOR_REVIEW' | 'REJECT_OVERRIDE' | 'HOLD_FOR_PRIORITY' | 'RELEASE_HOLD' | 'CONSIDER_FOR_NO_SHOW' | 'CLEAR_NO_SHOW_REVIEW'
export type CandidatePurpose = 'PRIORITY_ALTERNATIVE' | 'NO_SHOW_REPLACEMENT'

export interface WorkflowControl {
  activePriority: 1 | 2 | 3 | null
  canWorkDisruptions: boolean
  canWorkPredictions: boolean
  canReviewPool: boolean
  allowedActionsByType: Record<QueueType, RecoveryDecision[]>
  blockingWorkItemIds: string[]
  message: string | null
}

export interface Pagination {
  page: number
  totalPages: number
  hasNextPage: boolean
}

export interface RecoveryWorkItem {
  workItemId: string
  type: QueueType
  status: string
  predictionUnit: 'ULD'
  uld: { uldId: string; uldType: string; weightKg: number; volumeM3: number; origin: string; destination: string }
  masterAirwayBill: { number: string; documentId: string; displayLabel: string }
  flight: { flightId: string; origin: string; destination: string; scheduledDeparture: string | null; aircraftType: string | null }
  cargo: { shipmentIds: string[]; weightKg: number; volumeM3: number; handlingRequirements: string[]; commodity: string | null; valueAtRisk: number | null; currency: string | null }
  document: { documentId: string; version: number; updatedAt: string }
  updatedAt: string
  confirmedOffload?: { confirmedAt: string; source: 'OPERATIONAL_EVENT' | 'AUTHORIZED_DECISION'; sourceEventId: string; reason: string }
  forecast?: { offloadProbability: number; capacityShortfallKg: number; confidence: number; forecastedAt: string; reasons: string[]; forecastCargoCapacityKg: number; bookedWeightKg: number; valueAtRisk: number; currency: string }
  pool?: { source: 'DOMINO_OFFLOAD'; sourceFlightId: string; eligibleForNoShowReplacement: boolean; priorityHold: boolean; disposition: 'AVAILABLE' | 'PRIORITY_HOLD' | 'NO_SHOW_REVIEW'; lastDispositionAt?: string | null }
  caseSummary?: { disruption: string; capacityConstraint: string; deliveryCommitment: string; baselineExpectedLoss: number; currency: string }
  recoveryCaseId?: string
}

export interface FlightSummary {
  flightId: string; origin: string; destination: string; scheduledDeparture: string | null; aircraftType: string | null
  offloadProbability: number; capacityShortfallKg: number; forecastCargoCapacityKg: number; bookedWeightKg: number
  affectedUldCount: number; shipmentIds: string[]; valueAtRisk: number; currency: string; confidence: number
  forecastedAt: string; reasons: string[]
}

export interface RecoveryListResponse {
  items: RecoveryWorkItem[]
  totalItems: number
  totalByType: Record<QueueType, number>
  workflowControl: WorkflowControl
  flightSummaries: FlightSummary[]
  pagination: Pagination
}

export interface RecoveryReview {
  decisionId: string; type: QueueType; uldId: string; masterAirwayBillNumber: string; documentVersion: number
  optionId: string | null; targetWorkItemId: string | null; confirmedNoShowEventId: string | null
  decision: RecoveryDecision; reason: string; reviewerId: string; reviewedAt: string
}

export interface RecoveryDetail extends RecoveryWorkItem {
  workflowControl: WorkflowControl
  reviewHistory: RecoveryReview[]
}

export interface CostBreakdown {
  cargoCustomerImpact: number; cathayContributionImpact: number; recoveryAndHandlingCost: number
  delayAndServiceImpact: number; downstreamNetworkImpact: number; totalModeledExpectedLoss: number; currency: string
}

export interface RecoveryOption {
  optionId: string; optionType: 'rebook' | 'reroute' | 'wait_for_next_flight' | 'split'
  recoveryLegs: Array<{ from: string; to: string; operatingFlightId: string }>
  feasibilityStatus: 'Feasible' | 'Infeasible' | 'Feasibility Unknown'; feasibilityPercentage: number
  usableCapacityKg: number; capacityStatus: 'Confirmed' | 'Nominal / Weather Constrained' | 'Capacity Confirmation Pending'
  fuelConstraint: string; weatherExposure: string; expectedArrival: string; expectedDelayMinutes: number
  recoveryHandlingCost: number; totalModeledExpectedLoss: number; costBreakdown: CostBreakdown
  missingData: string[]; networkImpact: string
}

export interface RecoveryOptionsResponse { workItemId: string; type: Exclude<QueueType, 'PENDING_POOL'>; bestOptions: string[]; options: RecoveryOption[]; currency: string }
export interface RecoveryOptionDetail {
  option: RecoveryOption; workItemId: string; uldId: string; masterAirwayBillNumber: string
  costBreakdown: CostBreakdown
  networkDominoEffect: { affectedFlights: string[]; affectedUldIds: string[]; affectedShipmentIds: string[]; additionalCapacityShortfallKg: number; summary: string }
  scenarioSensitivity: Array<{ inputChange: string; feasibilityStatus: string; costBreakdown: CostBreakdown }>
  explanation: { summary: string; reasons: string[]; assumptions: string[]; missingData: string[] }
}

export interface ReplacementCandidate {
  candidateWorkItemId: string; targetWorkItemId: string; eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN'
  reasons: string[]; missingData: string[]; routeCompatible: boolean | null; handlingCompatible: boolean | null
  weightCapacityAvailableKg: number | null; volumeCapacityAvailableM3: number | null; requiresConfirmedNoShow: boolean
}
// The contract specifies the candidate fields but does not standardize the list envelope.
export type ReplacementCandidatesResponse = ReplacementCandidate[] | { candidates: ReplacementCandidate[] }

export interface SaveDecisionRequest {
  type: QueueType; uldId: string; masterAirwayBillNumber: string; documentVersion: number
  optionId: string | null; targetWorkItemId?: string | null; confirmedNoShowEventId?: string | null
  decision: RecoveryDecision; reason: string; reviewerId: string; reviewedAt: string
}
export interface SavedDecision {
  decisionId: string; workItemId: string; type: QueueType; uldId: string; masterAirwayBillNumber: string
  documentVersion: number; decision: RecoveryDecision; targetWorkItemId: string | null; reviewedAt: string
}

export type ApiFailureKind = 'network' | 'authorization' | 'not-found' | 'validation' | 'conflict' | 'gated' | 'server' | 'http' | 'invalid-response'
export class RecoveryApiError extends Error {
  readonly kind: ApiFailureKind
  readonly status?: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, kind: ApiFailureKind, status?: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'RecoveryApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.details = details
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const root = `${baseUrl}/api/v1/recovery-solutions`

function normalizePagination(input: Partial<Pagination> | undefined, page: number, count: number, total: number, limit: number): Pagination {
  const totalPages = Number.isInteger(input?.totalPages) && (input?.totalPages ?? 0) >= 1 ? input!.totalPages! : Math.max(1, Math.ceil(total / limit))
  const normalizedPage = Number.isInteger(input?.page) && (input?.page ?? 0) >= 1 ? input!.page! : page
  return { page: normalizedPage, totalPages, hasNextPage: typeof input?.hasNextPage === 'boolean' ? input.hasNextPage : normalizedPage < totalPages && count > 0 }
}

function parseFailure(status: number, body: unknown): RecoveryApiError {
  const rootBody = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const envelope = rootBody.error && typeof rootBody.error === 'object' ? rootBody.error as Record<string, unknown> : rootBody
  const code = typeof envelope.code === 'string' ? envelope.code : undefined
  const message = typeof envelope.message === 'string' ? envelope.message : `Recovery API request failed (${status}).`
  const details = envelope.details
  const kind: ApiFailureKind = status === 401 || status === 403 ? 'authorization'
    : status === 404 ? 'not-found' : status === 409 ? 'conflict' : status === 422 ? 'validation'
      : status === 423 ? 'gated' : status >= 500 ? 'server' : 'http'
  return new RecoveryApiError(message, kind, status, code, details)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${root}${path}`, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new RecoveryApiError(error instanceof Error ? error.message : 'Network request failed.', 'network')
  }
  let body: unknown
  try { body = await response.json() } catch { body = undefined }
  if (!response.ok) throw parseFailure(response.status, body)
  if (body === undefined) throw new RecoveryApiError('The API returned an empty or invalid JSON response.', 'invalid-response', response.status)
  return body as T
}

type RecoveryListPayload = Omit<RecoveryListResponse, 'pagination' | 'flightSummaries'> & { pagination?: Partial<Pagination>; flightSummaries?: FlightSummary[] }

export function normalizeRecoveryList(payload: RecoveryListPayload, requestPage = 1, requestLimit = 20): RecoveryListResponse {
  if (!Array.isArray(payload.items) || !payload.workflowControl || !payload.totalByType) throw new RecoveryApiError('The API response is missing items, counts, or workflowControl.', 'invalid-response')
  const workflow = payload.workflowControl as WorkflowControl
  const validPriority = workflow.activePriority === null || workflow.activePriority === 1 || workflow.activePriority === 2 || workflow.activePriority === 3
  if (!validPriority || typeof workflow.canWorkDisruptions !== 'boolean' || typeof workflow.canWorkPredictions !== 'boolean' || typeof workflow.canReviewPool !== 'boolean' || !Array.isArray(workflow.blockingWorkItemIds) || !workflow.allowedActionsByType || !Object.values(payload.totalByType).every((count) => Number.isInteger(count) && count >= 0) || !Number.isInteger(payload.totalItems) || payload.totalItems < 0) {
    throw new RecoveryApiError('The API response contains invalid pagination, counts, or workflow-control fields.', 'invalid-response')
  }
  if (!payload.items.every((item) => item && typeof item.workItemId === 'string' && typeof item.type === 'string' && item.uld && typeof item.uld.uldId === 'string' && item.masterAirwayBill && typeof item.masterAirwayBill.displayLabel === 'string' && item.flight && typeof item.flight.flightId === 'string' && item.cargo && typeof item.cargo.weightKg === 'number' && typeof item.updatedAt === 'string')) {
    throw new RecoveryApiError('The API returned a work item that does not match the recovery-solution contract.', 'invalid-response')
  }
  return { ...payload, flightSummaries: payload.flightSummaries ?? [], pagination: normalizePagination(payload.pagination, requestPage, payload.items.length, payload.totalItems, requestLimit) }
}

export interface RecoveryListQuery {
  type?: QueueType; page?: number; limit?: number; masterAirwayBillNumber?: string; flightId?: string; status?: string; includeClosed?: boolean
}

export async function listRecoverySolutions(query: RecoveryListQuery = {}, signal?: AbortSignal): Promise<RecoveryListResponse> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value))
  const page = query.page ?? 1; const limit = query.limit ?? 20
  const suffix = params.size ? `?${params}` : ''
  const payload = await request<RecoveryListPayload>(suffix, { signal })
  return normalizeRecoveryList(payload, page, limit)
}

export function getRecoverySolution(workItemId: string, signal?: AbortSignal): Promise<RecoveryDetail> {
  return request<RecoveryDetail>(`/${encodeURIComponent(workItemId)}`, { signal })
}

export interface ConfirmOffloadRequest {
  source: 'OPERATIONAL_EVENT' | 'AUTHORIZED_DECISION'
  sourceEventId: string
  confirmedAt: string
  reason: string
  reviewerId?: string
  documentVersion: number
}

export function confirmPredictedOffload(workItemId: string, confirmation: ConfirmOffloadRequest, signal?: AbortSignal): Promise<RecoveryWorkItem> {
  if (!confirmation.sourceEventId.trim() || !confirmation.reason.trim()) throw new RecoveryApiError('A confirmation event ID and reason are required.', 'validation')
  if (confirmation.source === 'AUTHORIZED_DECISION' && !confirmation.reviewerId?.trim()) throw new RecoveryApiError('A reviewer ID is required for an authorized decision.', 'validation')
  if (!Number.isInteger(confirmation.documentVersion) || confirmation.documentVersion < 1) throw new RecoveryApiError('A valid document version is required.', 'validation')
  if (!Number.isFinite(Date.parse(confirmation.confirmedAt))) throw new RecoveryApiError('confirmedAt must be a valid ISO timestamp.', 'validation')
  return request<RecoveryWorkItem>(`/${encodeURIComponent(workItemId)}/offload-confirmations`, { method: 'POST', body: JSON.stringify(confirmation), signal })
}

export function getRecoveryOptions(workItemId: string, signal?: AbortSignal): Promise<RecoveryOptionsResponse> {
  return request<RecoveryOptionsResponse>(`/${encodeURIComponent(workItemId)}/options`, { signal })
}

export function getRecoveryOption(workItemId: string, optionId: string, signal?: AbortSignal): Promise<RecoveryOptionDetail> {
  return request<RecoveryOptionDetail>(`/${encodeURIComponent(workItemId)}/options/${encodeURIComponent(optionId)}`, { signal })
}

export function getReplacementCandidates(workItemId: string, query: { targetWorkItemId: string; purpose: CandidatePurpose; confirmedNoShowEventId?: string }, signal?: AbortSignal): Promise<ReplacementCandidatesResponse> {
  if (!query.targetWorkItemId.trim()) throw new RecoveryApiError('A priority target work item is required.', 'validation')
  if (query.purpose === 'NO_SHOW_REPLACEMENT' && !query.confirmedNoShowEventId?.trim()) throw new RecoveryApiError('A validated no-show event ID is required for no-show replacement review.', 'validation')
  const params = new URLSearchParams({ targetWorkItemId: query.targetWorkItemId, purpose: query.purpose })
  if (query.confirmedNoShowEventId) params.set('confirmedNoShowEventId', query.confirmedNoShowEventId)
  return request<ReplacementCandidatesResponse>(`/${encodeURIComponent(workItemId)}/replacement-candidates?${params}`, { signal })
}

export function saveRecoveryDecision(workItemId: string, decision: SaveDecisionRequest, signal?: AbortSignal): Promise<SavedDecision> {
  const allowedByType: Record<QueueType, RecoveryDecision[]> = {
    DISRUPTION: ['APPROVE_FOR_REVIEW', 'REJECT_OVERRIDE'],
    PREDICTED_OFFLOAD: ['APPROVE_FOR_REVIEW', 'REJECT_OVERRIDE'],
    PENDING_POOL: ['HOLD_FOR_PRIORITY', 'RELEASE_HOLD', 'CONSIDER_FOR_NO_SHOW', 'CLEAR_NO_SHOW_REVIEW'],
  }
  if (!allowedByType[decision.type].includes(decision.decision)) throw new RecoveryApiError(`${decision.decision} is not valid for ${decision.type}.`, 'validation')
  if (!decision.uldId.trim() || !decision.masterAirwayBillNumber.trim() || !decision.reviewerId.trim() || !decision.reason.trim()) throw new RecoveryApiError('ULD, MAWB, reviewer, and reason are required.', 'validation')
  if (!Number.isInteger(decision.documentVersion) || decision.documentVersion < 1) throw new RecoveryApiError('A valid document version is required.', 'validation')
  if (decision.decision === 'APPROVE_FOR_REVIEW' && !decision.optionId?.trim()) throw new RecoveryApiError('Choose a routing option before approving it for review.', 'validation')
  if (decision.decision === 'CONSIDER_FOR_NO_SHOW' && (!decision.targetWorkItemId?.trim() || !decision.confirmedNoShowEventId?.trim())) throw new RecoveryApiError('No-show review requires a target work item and confirmed no-show event ID.', 'validation')
  if (!Number.isFinite(Date.parse(decision.reviewedAt))) throw new RecoveryApiError('reviewedAt must be a valid ISO timestamp.', 'validation')
  return request<SavedDecision>(`/${encodeURIComponent(workItemId)}/decisions`, { method: 'POST', body: JSON.stringify(decision), signal })
}
