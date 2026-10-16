export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'
export type WeatherPathway = 'Fuel / payload' | 'Route / operational' | 'Ground handling'

export interface ReportingPeriod {
  label: string
  start: string
  end: string
  timezone: string
}

export interface OffloadMetrics {
  actualOffloadRate: number | null
  actualOffloadedShipments: number
  eligibleShipments: number
  predictedOffloadRate: number | null
  predictedOffloadedShipments: number
  forecastShipmentsConsidered: number
  flightOffloadProbability: number | null
  reportingPeriod: ReportingPeriod
}

export interface OffloadOutcome {
  flightId: string
  route: string
  category: string
  predictedOffload: boolean
  actualOffload: boolean
  predictedRate: number
  actualRate: number
  valueAtRisk: number
  realisedLoss: number
  interventionApplied: boolean
  forecastLeadHours?: number
}

export type OffloadLifecycleState = 'ON_TRACK' | 'AT_RISK' | 'PREVENTIVE_ACTION_REQUIRED' | 'OFFLOAD_CONFIRMED' | 'RECOVERY_IN_PROGRESS' | 'RECOVERED' | 'CLOSED' | 'REVIEW_REQUIRED'

export interface OffloadLifecycleRecord {
  id: string
  flightId: string
  shipmentIds: string[]
  state: OffloadLifecycleState
  recoveryCaseId?: string
  authoritativeSource: 'forecast' | 'authorized-decision' | 'operational-event' | 'demo-record'
  statusLabel: string
  recordedAt: string
  simulated: true
  transitionHistory: string[]
}

export interface OverviewQueueItem {
  lifecycle: OffloadLifecycleRecord
  forecast?: FlightCapacityForecast
  recoveryCase?: RecoveryCase
  estimatedImpact: number
}

export interface OverviewQueues {
  preventive: OverviewQueueItem[]
  recovery: OverviewQueueItem[]
  onTrack: OverviewQueueItem[]
  review: OverviewQueueItem[]
}

export interface OverviewMetrics {
  upcomingFlights: number
  flightsAtRisk: number
  predictedOffloads: number
  confirmedOffloads: number
  shipmentsRequiringAttention: number
  activeRecoveryCases: number
}

export interface AnalyticsMetric {
  numerator: number
  denominator: number
  rate: number | null
}

export interface AnalyticsSummary {
  predictedRate: number
  actualRate: number
  falseAlarmRate: number
  missedOffloadRate: number
  estimatedValueAtRisk: number
  realisedLoss: number
  interventionCount: number
  interventionSuccessRate: number
  leadTimeHours: number | null
  sampleSize: number
  sufficientSample: boolean
  falseAlarm: AnalyticsMetric
  missedOffload: AnalyticsMetric
  interventionSuccess: AnalyticsMetric
  meanAbsoluteProbabilityError: number | null
  flightRateError: number | null
  businessImpactDataAvailable: boolean
  recoveryCostDataAvailable: boolean
}

export type TrendMetric = 'shipment' | 'weight' | 'volume'

export interface OffloadTrendPoint {
  departureDate: string
  flightId: string
  route: string
  metric: TrendMetric
  isFuture: boolean
  actualRate: number | null
  predictedRate: number | null
  eligibleCount: number | null
  actualOffloadCount: number | null
  predictionTimestamp: string | null
  forecastLeadHours: number
  confidenceLower: number | null
  confidenceUpper: number | null
}

export interface Shipment {
  id: string
  customer: string
  category: string
  origin: string
  destination: string
  flightId: string
  weightKg: number
  volumeM3: number
  priority: 'Critical' | 'High' | 'Standard'
  deadline: string
  offloadProbability: number
  estimatedDelayHours: number
  cargoImpact: number
  cathayImpact: number
  recoveryAvailable: boolean
  riskDrivers: string[]
  declaredCargoValue?: number
}

export interface WeatherRiskAssessment {
  flightId: string
  locationOrRouteSegment: string
  weatherCondition: string
  expectedTimeWindow: string
  forecastSource: string
  forecastTimestamp: string
  severity: RiskLevel
  estimatedOperationalImpact: string
  estimatedFuelImpactKg: number | null
  estimatedPayloadImpactKg: number | null
  pathway: WeatherPathway
  confidence: number
  dataAvailability: 'Sufficient' | 'Partial'
}

export interface FlightCapacityForecast {
  flightId: string
  route: string
  departure: string
  aircraftType: string
  plannedFuelWeight: number
  latestEstimatedFuelWeight: number
  forecastAdditionalFuelWeight: number
  fuelEstimateTimestamp: string
  originalCargoCapacity: number
  approvedOrSourcedAvailablePayload: number
  forecastCargoCapacity: number
  forecastBookedWeight: number
  forecastBookedVolume: number
  forecastCapacityShortfall: number
  forecastVolumeShortfall: number
  weatherRiskLevel: RiskLevel
  weatherRiskDrivers: string[]
  expectedOperationalImpact: string
  forecastOffloadProbability: number
  predictedOffloadRate: number
  affectedShipments: number
  valueAtRisk: number
  forecastConfidence: number
  simulated: true
  assumptions: string[]
  riskDrivers: string[]
}

export interface ForecastUpdate {
  latestEstimatedFuelWeight?: number
  weather?: Partial<Pick<WeatherRiskAssessment, 'severity' | 'weatherCondition' | 'pathway' | 'estimatedFuelImpactKg' | 'estimatedPayloadImpactKg' | 'estimatedOperationalImpact'>>
}

export const predictionConfig = {
  highRiskProbabilityThreshold: 0.25,
  thresholdMeaning: 'Operator triage threshold for reviewing a forecast; it is not an approved Cathay service level.',
}

export interface RecoveryOption {
  id: string
  caseId: string
  shipmentId: string
  original: string
  alternative: string
  alternativeFlight: string
  usableCapacityKg: number
  capacityStatus: 'Confirmed' | 'Nominal / weather constrained' | 'Capacity confirmation pending'
  fuelConstraint: string
  weatherExposure: string
  expectedArrival: string
  delayHours: number
  cost: number
  totalExpectedLoss: number
  feasibility: number
  networkImpact: string
  explanation: string
  scenarioAdjustment?: number
}

export interface RecoveryCase {
  id: string
  originalFlight: string
  origin: string
  destination: string
  scheduledDeparture: string
  affectedShipmentIds: string[]
  reason: string
  capacityConstraint: string
  deliveryCommitment: string
  disruption: string
  baselineExpectedLoss: number
  assumptions: string[]
}

interface RecoveryShipmentContext {
  id: string
  weightKg: number
  cargoImpact: number
  cathayImpact: number
  deadline: string
}

export type OptimizationStatus = 'OPTIMAL' | 'BEST_FEASIBLE_FOUND' | 'HEURISTIC_SUGGESTION' | 'NO_FEASIBLE_PLAN' | 'INSUFFICIENT_DATA' | 'NOT_EVALUATED'

export interface RecoveryCostBreakdown {
  cargoCustomerImpact: number
  cathayContributionImpact: number
  recoveryAndHandlingCost: number
  delayAndServiceImpact: number
  downstreamNetworkImpact: number
  totalExpectedLoss: number
}

export interface RecoveryEvaluation {
  option: RecoveryOption
  recommendationVersion: string
  optimizationStatus: OptimizationStatus | string
  isFeasible: boolean
  affectedFlights: string[]
  affectedShipments: string[]
  costBreakdown: RecoveryCostBreakdown
  objectiveDefinition: string
  objectiveWeights: Record<string, number>
  hardConstraints: string[]
  rejectedReasons: string[]
  alternativesConsidered: string[]
  assumptions: string[]
  missingData: string[]
  predictionTimestamp: string
  optimizationTimestamp: string
  terminationReason: string
  optimalityGap: number | null
  deliveryCommitmentFeasible: boolean | null
  networkShortfallKg: number
  additionalAffectedShipments: string[]
  feasibilityStatus?: 'Feasible' | 'Infeasible' | 'Feasibility unknown'
  feasibilityReasons?: string[]
}

export interface RecoveryDecision {
  optionId: string
  decision: 'approved-for-review' | 'rejected-override'
  reason: string
  recordedAt: string
  simulated: true
}

export type RecoveryScenario = 'no-intervention' | 'preventive' | 'recover'

export interface ShipmentValueAssessment {
  shipmentId: string
  baselineLoss: number
  latestScenarioLoss: number
  preventiveScenarioLoss: number
  recoveryCost: number
  cargoCustomerImpact: number
  cathayContributionImpact: number
  lowEstimate: number
  highEstimate: number
  confidence: number
  assumptions: string[]
}

export type ShipmentValueScenario = 'baseline' | 'latest' | 'preventive'

export interface CustomerValueProfile {
  customer: string
  segment: string
  historicalShipments: number
  historicalRevenue: number
  serviceCommitment: string
  currentShipmentsAtRisk: number
  currentValueAtRisk: number
  historicalOffloadRate: number
  handlingRequirements: string
}

export const weatherAssessments: WeatherRiskAssessment[] = [
  { flightId: 'CX257', locationOrRouteSegment: 'LHR arrival / North Atlantic', weatherCondition: 'Low visibility and headwinds', expectedTimeWindow: '18:00-22:00 UTC', forecastSource: 'Synthetic METAR + route model', forecastTimestamp: '16 Oct 2026 09:10 UTC', severity: 'High', estimatedOperationalImpact: 'Headwinds increase fuel planning; low visibility may slow ramp release.', estimatedFuelImpactKg: 1800, estimatedPayloadImpactKg: 1800, pathway: 'Fuel / payload', confidence: 84, dataAvailability: 'Sufficient' },
  { flightId: 'CX289', locationOrRouteSegment: 'FRA departure', weatherCondition: 'Ramp thunderstorms', expectedTimeWindow: '20:00-23:00 UTC', forecastSource: 'Synthetic airport weather feed', forecastTimestamp: '16 Oct 2026 08:45 UTC', severity: 'Moderate', estimatedOperationalImpact: 'Ground-handling delay risk; no payload reduction supported by current data.', estimatedFuelImpactKg: null, estimatedPayloadImpactKg: null, pathway: 'Ground handling', confidence: 71, dataAvailability: 'Partial' },
  { flightId: 'CX880', locationOrRouteSegment: 'HKG-LAX route', weatherCondition: 'Moderate turbulence', expectedTimeWindow: '02:00-07:00 UTC', forecastSource: 'Synthetic route weather feed', forecastTimestamp: '16 Oct 2026 09:00 UTC', severity: 'Moderate', estimatedOperationalImpact: 'Possible route deviation; current payload impact is unconfirmed.', estimatedFuelImpactKg: 500, estimatedPayloadImpactKg: null, pathway: 'Route / operational', confidence: 62, dataAvailability: 'Partial' },
  { flightId: 'CX840', locationOrRouteSegment: 'JFK arrival', weatherCondition: 'Clear conditions', expectedTimeWindow: '23:00-02:00 UTC', forecastSource: 'Synthetic airport weather feed', forecastTimestamp: '16 Oct 2026 09:05 UTC', severity: 'Low', estimatedOperationalImpact: 'No material operational impact identified.', estimatedFuelImpactKg: 0, estimatedPayloadImpactKg: 0, pathway: 'Route / operational', confidence: 93, dataAvailability: 'Sufficient' },
]

export const shipments: Shipment[] = [
  { id: 'CX-482901', customer: 'Northstar Pharma', category: 'Pharmaceuticals', origin: 'HKG', destination: 'LHR', flightId: 'CX257', weightKg: 1650, volumeM3: 8.2, priority: 'Critical', deadline: '17 Oct, 06:00', offloadProbability: 0.86, estimatedDelayHours: 12, cargoImpact: 42000, cathayImpact: 9800, recoveryAvailable: true, riskDrivers: ['Fuel-driven payload reduction', 'LHR visibility', 'Tight delivery deadline'], declaredCargoValue: 180000 },
  { id: 'CX-483117', customer: 'Helix Components', category: 'General cargo', origin: 'SIN', destination: 'FRA', flightId: 'CX289', weightKg: 980, volumeM3: 5.8, priority: 'High', deadline: '17 Oct, 12:00', offloadProbability: 0.54, estimatedDelayHours: 8, cargoImpact: 9200, cathayImpact: 2400, recoveryAvailable: true, riskDrivers: ['Ground-handling delay', 'Limited confirmed alternatives'], declaredCargoValue: 46000 },
  { id: 'CX-482774', customer: 'Pacific Retail', category: 'General cargo', origin: 'HKG', destination: 'LAX', flightId: 'CX880', weightKg: 720, volumeM3: 4.1, priority: 'Standard', deadline: '18 Oct, 09:00', offloadProbability: 0.22, estimatedDelayHours: 5, cargoImpact: 2800, cathayImpact: 900, recoveryAvailable: true, riskDrivers: ['Route uncertainty'], declaredCargoValue: 22000 },
  { id: 'CX-482630', customer: 'Apex Electronics', category: 'High value', origin: 'HKG', destination: 'JFK', flightId: 'CX840', weightKg: 610, volumeM3: 3.4, priority: 'High', deadline: '17 Oct, 15:00', offloadProbability: 0.12, estimatedDelayHours: 4, cargoImpact: 1400, cathayImpact: 600, recoveryAvailable: false, riskDrivers: ['Booking demand uncertainty'], declaredCargoValue: 85000 },
]

export const customerProfiles: CustomerValueProfile[] = [
  { customer: 'Northstar Pharma', segment: 'Strategic healthcare', historicalShipments: 184, historicalRevenue: 286000, serviceCommitment: 'Priority delivery window', currentShipmentsAtRisk: 1, currentValueAtRisk: 36120, historicalOffloadRate: 0.018, handlingRequirements: 'Temperature-sensitive, priority handling' },
  { customer: 'Helix Components', segment: 'Enterprise manufacturing', historicalShipments: 96, historicalRevenue: 124000, serviceCommitment: 'Standard SLA', currentShipmentsAtRisk: 1, currentValueAtRisk: 4968, historicalOffloadRate: 0.031, handlingRequirements: 'General cargo, protected handling' },
  { customer: 'Pacific Retail', segment: 'Commercial', historicalShipments: 62, historicalRevenue: 71000, serviceCommitment: 'Standard SLA', currentShipmentsAtRisk: 0, currentValueAtRisk: 616, historicalOffloadRate: 0.027, handlingRequirements: 'General cargo' },
  { customer: 'Apex Electronics', segment: 'High-value goods', historicalShipments: 78, historicalRevenue: 148000, serviceCommitment: 'Timed delivery', currentShipmentsAtRisk: 0, currentValueAtRisk: 168, historicalOffloadRate: 0.012, handlingRequirements: 'High-value security controls' },
]

export function assessShipmentValue(shipment: Shipment, scenarioDelayHours = shipment.estimatedDelayHours): ShipmentValueAssessment {
  const delayFactor = Math.min(1.25, scenarioDelayHours / 12)
  const baselineLoss = shipment.cargoImpact * shipment.offloadProbability
  const latestScenarioLoss = shipment.cargoImpact * Math.min(1, shipment.offloadProbability * (0.85 + delayFactor * 0.35))
  const recoveryCost = shipment.recoveryAvailable ? Math.round(shipment.cathayImpact * 0.55) : 0
  const preventiveScenarioLoss = Math.max(0, latestScenarioLoss - (shipment.recoveryAvailable ? shipment.cargoImpact * 0.28 : 0))
  const centralEstimate = Math.round(latestScenarioLoss + recoveryCost)
  return { shipmentId: shipment.id, baselineLoss: Math.round(baselineLoss), latestScenarioLoss: Math.round(latestScenarioLoss), preventiveScenarioLoss: Math.round(preventiveScenarioLoss), recoveryCost, cargoCustomerImpact: Math.round(latestScenarioLoss), cathayContributionImpact: shipment.cathayImpact, lowEstimate: Math.round(centralEstimate * 0.75), highEstimate: Math.round(centralEstimate * 1.35), confidence: shipment.recoveryAvailable ? 76 : 58, assumptions: ['Delay sensitivity is category-based and illustrative.', 'Declared cargo value is not treated as realised loss.', 'Recovery cost and Cathay contribution are separate from customer impact.'] }
}

export function getShipmentScenarioLoss(value: ShipmentValueAssessment, scenario: ShipmentValueScenario): number {
  return scenario === 'baseline' ? value.baselineLoss : scenario === 'preventive' ? value.preventiveScenarioLoss + value.recoveryCost : value.latestScenarioLoss + value.recoveryCost
}

export function calculatePotentialLossAvoidable(shipmentPopulation: Shipment[] = shipments): number {
  return Math.round(shipmentPopulation.reduce((total, shipment) => {
    const assessment = assessShipmentValue(shipment)
    const feasiblePreventiveLoss = shipment.recoveryAvailable ? assessment.preventiveScenarioLoss + assessment.recoveryCost : assessment.baselineLoss
    return total + Math.max(0, assessment.baselineLoss - feasiblePreventiveLoss)
  }, 0))
}

const flightInputs = [
  { flightId: 'CX257', route: 'HKG → LHR', departure: 'Today, 18:40', aircraftType: 'B777-300ER', plannedFuelWeight: 112000, latestEstimatedFuelWeight: 113800, originalCargoCapacity: 17000, booked: 18200, volume: 92, payload: 15200, confidence: 84 },
  { flightId: 'CX289', route: 'SIN → FRA', departure: 'Today, 21:15', aircraftType: 'A350-1000', plannedFuelWeight: 98000, latestEstimatedFuelWeight: 98000, originalCargoCapacity: 14500, booked: 13900, volume: 76, payload: 14500, confidence: 71 },
  { flightId: 'CX880', route: 'HKG → LAX', departure: 'Tomorrow, 02:05', aircraftType: 'B777-300ER', plannedFuelWeight: 108000, latestEstimatedFuelWeight: 108500, originalCargoCapacity: 16100, booked: 14800, volume: 81, payload: 15600, confidence: 62 },
  { flightId: 'CX840', route: 'HKG → JFK', departure: 'Today, 23:50', aircraftType: 'A350-1000', plannedFuelWeight: 101000, latestEstimatedFuelWeight: 101000, originalCargoCapacity: 15000, booked: 12800, volume: 67, payload: 15000, confidence: 93 },
]

export function buildForecasts(updates: Record<string, ForecastUpdate> = {}): FlightCapacityForecast[] {
  return flightInputs.map((input) => {
    const sourceWeather = weatherAssessments.find((item) => item.flightId === input.flightId)!
    const update = updates[input.flightId] ?? {}
    const weather = { ...sourceWeather, ...update.weather }
    const latestEstimatedFuelWeight = update.latestEstimatedFuelWeight ?? input.latestEstimatedFuelWeight
    const additionalFuel = Math.max(0, latestEstimatedFuelWeight - input.plannedFuelWeight)
    const fuelPayloadReduction = Math.max(weather.estimatedPayloadImpactKg ?? 0, additionalFuel)
    const forecastCargoCapacity = Math.max(0, input.payload - fuelPayloadReduction)
    const shortfall = Math.max(0, input.booked - forecastCargoCapacity)
    const affected = shipments.filter((shipment) => shipment.flightId === input.flightId && shipment.weightKg > Math.max(0, forecastCargoCapacity - input.booked)).length
    const predictedOffloadRate = input.booked ? Math.min(1, shortfall / input.booked) : 0
    const flightProbability = Math.min(0.98, Math.max(predictedOffloadRate * 1.25, weather.pathway === 'Ground handling' ? 0.14 : 0.08))
    const valueAtRisk = shipments.filter((shipment) => shipment.flightId === input.flightId).reduce((sum, shipment) => sum + shipment.cargoImpact * shipment.offloadProbability, 0)
    const riskDrivers = [
      ...(additionalFuel > 0 ? [`Additional fuel estimate +${formatKg(additionalFuel)} may reduce payload.`] : []),
      ...(weather.severity !== 'Low' ? [`${weather.weatherCondition} via ${weather.pathway}.`] : []),
      ...(shortfall > 0 ? [`Booked weight exceeds forecast cargo capacity by ${formatKg(shortfall)}.`] : []),
      ...(input.volume >= 90 ? ['Booked volume is near the simulated aircraft limit.'] : []),
      ...(weather.severity === 'Low' && additionalFuel === 0 && shortfall === 0 ? ['No material fuel, weather, weight, or volume driver supported by current data.'] : []),
    ]
    return { flightId: input.flightId, route: input.route, departure: input.departure, aircraftType: input.aircraftType, plannedFuelWeight: input.plannedFuelWeight, latestEstimatedFuelWeight, forecastAdditionalFuelWeight: additionalFuel, fuelEstimateTimestamp: '16 Oct 2026 09:10 UTC', originalCargoCapacity: input.originalCargoCapacity, approvedOrSourcedAvailablePayload: input.payload, forecastCargoCapacity, forecastBookedWeight: input.booked, forecastBookedVolume: input.volume, forecastCapacityShortfall: shortfall, forecastVolumeShortfall: 0, weatherRiskLevel: weather.severity, weatherRiskDrivers: [weather.weatherCondition], expectedOperationalImpact: weather.estimatedOperationalImpact, forecastOffloadProbability: flightProbability, predictedOffloadRate, affectedShipments: shortfall > 0 ? Math.max(affected, 1) : 0, valueAtRisk, forecastConfidence: input.confidence, simulated: true, assumptions: ['Approved payload is represented by a simulated operational capacity source.', 'Fuel delta is applied once; required safety fuel is never reduced.', 'Aircraft substitution, baggage and ULD compatibility are unavailable in current fixtures.', 'Declared cargo value is not treated as Cathay loss.'], riskDrivers }
  })
}

export const recoveryCases: RecoveryCase[] = [
  { id: 'RC-257-LHR', originalFlight: 'CX257', origin: 'HKG', destination: 'LHR', scheduledDeparture: '16 Oct, 18:30', affectedShipmentIds: ['CX-482901'], reason: 'Fuel-driven payload reduction with FRA weather exposure', disruption: 'Increased fuel requirement creates a payload shortfall while intermediate weather reduces connection flexibility.', capacityConstraint: 'CX257 forecast shortfall requires an alternative connection', deliveryCommitment: '17 Oct, 12:00 priority delivery window', baselineExpectedLoss: 31200, assumptions: ['Temperature-sensitive handling remains available on every candidate.', 'Partner connection capacity is simulated and requires station confirmation.'] },
  { id: 'RC-288-HKG', originalFlight: 'CX288', origin: 'FRA', destination: 'HKG', scheduledDeparture: '16 Oct, 20:10', affectedShipmentIds: ['RC-288-CARGO'], reason: 'Original flight cancelled', disruption: 'Cancellation removes the planned FRA-HKG movement and compresses the delivery window.', capacityConstraint: 'Replacement capacity must cover the affected 1250 kg shipment group.', deliveryCommitment: '18 Oct, 06:00 committed delivery window', baselineExpectedLoss: 28400, assumptions: ['Cancellation is confirmed in the simulated scenario.', 'Alternative handling and customs acceptance are not connected to live systems.'] },
  { id: 'RC-289-FRA', originalFlight: 'CX289', origin: 'SIN', destination: 'FRA', scheduledDeparture: '16 Oct, 21:15', affectedShipmentIds: ['CX-483117'], reason: 'Adverse weather and updated fuel requirement', disruption: 'Ramp weather and fuel changes reduce usable payload on the original movement.', capacityConstraint: 'At least 980 kg of eligible cargo must be protected without relaxing safety fuel.', deliveryCommitment: '17 Oct, 12:00 standard SLA', baselineExpectedLoss: 19800, assumptions: ['Lower-impact cargo may be deferred before critical cargo.', 'Weather payload impact remains forecast evidence, not confirmed operational fact.'] },
  { id: 'RC-840-JFK', originalFlight: 'CX840', origin: 'HKG', destination: 'JFK', scheduledDeparture: '16 Oct, 23:50', affectedShipmentIds: ['CX-482630'], reason: 'Aircraft substitution creates a payload shortfall', disruption: 'A substituted aircraft reduces approved payload for a high-value shipment.', capacityConstraint: 'The replacement must meet high-value handling and JFK delivery constraints.', deliveryCommitment: '17 Oct, 15:00 timed delivery', baselineExpectedLoss: 17600, assumptions: ['Security handling is available only on marked compatible alternatives.', 'Aircraft substitution details are fictional demonstration inputs.'] },
  { id: 'RC-PERISHABLE-01', originalFlight: 'CX880', origin: 'HKG', destination: 'LAX', scheduledDeparture: '17 Oct, 02:05', affectedShipmentIds: ['RC-PERISHABLE-CARGO'], reason: 'Missed connection threatens remaining perishable delivery window', disruption: 'A missed connection leaves only a short usable delivery window for temperature-sensitive cargo.', capacityConstraint: 'Arrival must be before the mandatory 18 Oct, 09:00 handling cut-off.', deliveryCommitment: '18 Oct, 09:00 perishable handling cut-off', baselineExpectedLoss: 22600, assumptions: ['Cargo impact is delay-based and does not equal declared value.', 'Temperature-controlled acceptance must be confirmed at the connection point.'] },
]

const recoveryShipmentContexts: Record<string, RecoveryShipmentContext> = {
  'RC-288-CARGO': { id: 'RC-288-CARGO', weightKg: 1250, cargoImpact: 16800, cathayImpact: 4200, deadline: '18 Oct, 06:00' },
  'RC-PERISHABLE-CARGO': { id: 'RC-PERISHABLE-CARGO', weightKg: 680, cargoImpact: 22000, cathayImpact: 3600, deadline: '18 Oct, 09:00' },
}

export const recoveryOptions: RecoveryOption[] = [
  { id: 'R-257-01', caseId: 'RC-257-LHR', shipmentId: 'CX-482901', original: 'HKG → LHR · CX257', alternative: 'HKG → FRA → LHR', alternativeFlight: 'CX289 + partner connection', usableCapacityKg: 1200, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'FRA payload buffer reduced by 600 kg', weatherExposure: 'FRA thunderstorms may add 2h handling', expectedArrival: '17 Oct, 05:40', delayHours: 4, cost: 420, totalExpectedLoss: 0, feasibility: 78, networkImpact: 'May consume capacity on CX289; downstream impact uncertain.', explanation: 'Earlier arrival protects the deadline, but capacity remains subject to weather confirmation.' },
  { id: 'R-257-02', caseId: 'RC-257-LHR', shipmentId: 'CX-482901', original: 'HKG → LHR · CX257', alternative: 'HKG → DOH → LHR', alternativeFlight: 'CX660 + partner connection', usableCapacityKg: 1800, capacityStatus: 'Confirmed', fuelConstraint: 'No additional fuel constraint identified', weatherExposure: 'DOH clear; LHR low visibility remains', expectedArrival: '17 Oct, 09:10', delayHours: 8, cost: 680, totalExpectedLoss: 0, feasibility: 91, networkImpact: 'No known displaced cargo; confirmed capacity.', explanation: 'Confirmed capacity reduces operational uncertainty but creates a longer delay.' },
  { id: 'R-257-03', caseId: 'RC-257-LHR', shipmentId: 'CX-482901', original: 'HKG → LHR · CX257', alternative: 'HKG → SIN → LHR', alternativeFlight: 'CX711 + partner connection', usableCapacityKg: 1900, capacityStatus: 'Confirmed', fuelConstraint: 'SIN departure fuel buffer unchanged', weatherExposure: 'SIN clear; LHR low visibility remains', expectedArrival: '17 Oct, 11:20', delayHours: 10, cost: 520, totalExpectedLoss: 0, feasibility: 86, networkImpact: 'Uses confirmed connection capacity; no displaced cargo identified.', explanation: 'A lower-cost confirmed route, but it leaves less buffer before the delivery window.' },
  { id: 'R-257-04', caseId: 'RC-257-LHR', shipmentId: 'CX-482901', original: 'HKG → LHR · CX257', alternative: 'Later direct HKG → LHR', alternativeFlight: 'CX251 later departure', usableCapacityKg: 1750, capacityStatus: 'Capacity confirmation pending', fuelConstraint: 'Later flight fuel plan not yet confirmed', weatherExposure: 'North Atlantic headwinds remain possible', expectedArrival: '17 Oct, 07:30', delayHours: 7, cost: 250, totalExpectedLoss: 0, feasibility: 55, networkImpact: 'Direct movement avoids hub displacement if capacity is confirmed.', explanation: 'Potentially efficient direct recovery, pending capacity and fuel confirmation.' },
  { id: 'R-257-05', caseId: 'RC-257-LHR', shipmentId: 'CX-482901', original: 'HKG → LHR · CX257', alternative: 'Partial split via SIN', alternativeFlight: 'CX711 + CX251', usableCapacityKg: 900, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'Split movement requires two fuel checks', weatherExposure: 'LHR visibility and SIN handling coordination risk', expectedArrival: '17 Oct, 13:30', delayHours: 12, cost: 310, totalExpectedLoss: 0, feasibility: 42, networkImpact: 'Partial reassignment may expose remaining cargo on CX251.', explanation: 'Lower direct cost, but the shipment cannot be operationally split under current handling data.' },
  { id: 'R-288-01', caseId: 'RC-288-HKG', shipmentId: 'RC-288-CARGO', original: 'FRA → HKG · CX288', alternative: 'FRA → DOH → HKG', alternativeFlight: 'CX660 + partner connection', usableCapacityKg: 1500, capacityStatus: 'Confirmed', fuelConstraint: 'No additional fuel constraint identified', weatherExposure: 'DOH clear; HKG moderate rain', expectedArrival: '17 Oct, 22:00', delayHours: 14, cost: 740, totalExpectedLoss: 0, feasibility: 88, networkImpact: 'Confirmed capacity with no displaced cargo identified.', explanation: 'Most reliable replacement, with a longer transit and higher handling cost.' },
  { id: 'R-288-02', caseId: 'RC-288-HKG', shipmentId: 'RC-288-CARGO', original: 'FRA → HKG · CX288', alternative: 'FRA → SIN → HKG', alternativeFlight: 'CX289 + partner connection', usableCapacityKg: 1400, capacityStatus: 'Confirmed', fuelConstraint: 'SIN connection fuel plan confirmed', weatherExposure: 'FRA ramp weather may add handling time', expectedArrival: '17 Oct, 18:30', delayHours: 10, cost: 920, totalExpectedLoss: 0, feasibility: 84, networkImpact: 'May consume 1,250 kg on CX289; downstream impact is modeled.', explanation: 'Earlier than DOH but carries a higher network displacement cost.' },
  { id: 'R-288-03', caseId: 'RC-288-HKG', shipmentId: 'RC-288-CARGO', original: 'FRA → HKG · CX288', alternative: 'Next suitable FRA → HKG departure', alternativeFlight: 'CX290 next departure', usableCapacityKg: 1600, capacityStatus: 'Confirmed', fuelConstraint: 'Next-flight fuel plan available', weatherExposure: 'No additional route weather exposure identified', expectedArrival: '18 Oct, 04:30', delayHours: 20, cost: 360, totalExpectedLoss: 0, feasibility: 93, networkImpact: 'No known displaced cargo; later arrival consumes commitment buffer.', explanation: 'Lowest handling cost with a material service delay.' },
  { id: 'R-288-04', caseId: 'RC-288-HKG', shipmentId: 'RC-288-CARGO', original: 'FRA → HKG · CX288', alternative: 'FRA → BKK → HKG', alternativeFlight: 'CX730 + partner connection', usableCapacityKg: 1300, capacityStatus: 'Capacity confirmation pending', fuelConstraint: 'Partner payload plan pending', weatherExposure: 'BKK thunderstorms may affect connection', expectedArrival: '18 Oct, 01:10', delayHours: 17, cost: 480, totalExpectedLoss: 0, feasibility: 58, networkImpact: 'Downstream impact unknown until partner capacity is confirmed.', explanation: 'Potentially balanced route, but required partner confirmation is missing.' },
  { id: 'R-288-05', caseId: 'RC-288-HKG', shipmentId: 'RC-288-CARGO', original: 'FRA → HKG · CX288', alternative: 'FRA → LHR → HKG', alternativeFlight: 'CX257 + partner connection', usableCapacityKg: 800, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'LHR fuel uplift may reduce payload', weatherExposure: 'LHR low visibility and tight connection', expectedArrival: '18 Oct, 08:00', delayHours: 24, cost: 300, totalExpectedLoss: 0, feasibility: 35, networkImpact: 'Capacity shortfall would expose the shipment group.', explanation: 'Cheap but fails the modeled capacity and delivery constraints.' },
  { id: 'R-289-01', caseId: 'RC-289-FRA', shipmentId: 'CX-483117', original: 'SIN → FRA · CX289', alternative: 'SIN → DOH → FRA', alternativeFlight: 'CX660 + partner connection', usableCapacityKg: 1200, capacityStatus: 'Confirmed', fuelConstraint: 'No additional fuel constraint identified', weatherExposure: 'DOH clear; FRA ramp weather remains', expectedArrival: '17 Oct, 08:00', delayHours: 3, cost: 610, totalExpectedLoss: 0, feasibility: 92, networkImpact: 'Confirmed capacity; no displaced cargo identified.', explanation: 'Protects the service window with moderate handling cost.' },
  { id: 'R-289-02', caseId: 'RC-289-FRA', shipmentId: 'CX-483117', original: 'SIN → FRA · CX289', alternative: 'Later SIN → FRA departure', alternativeFlight: 'CX291 later departure', usableCapacityKg: 1400, capacityStatus: 'Confirmed', fuelConstraint: 'Later departure fuel plan confirmed', weatherExposure: 'FRA ramp weather may persist', expectedArrival: '17 Oct, 15:00', delayHours: 10, cost: 220, totalExpectedLoss: 0, feasibility: 95, networkImpact: 'No downstream displacement identified.', explanation: 'Lowest recovery cost, but the later arrival increases customer impact.' },
  { id: 'R-289-03', caseId: 'RC-289-FRA', shipmentId: 'CX-483117', original: 'SIN → FRA · CX289', alternative: 'Reallocate to lower-impact cargo plan', alternativeFlight: 'CX880 priority allocation', usableCapacityKg: 1100, capacityStatus: 'Confirmed', fuelConstraint: 'Payload allocation preserves required fuel', weatherExposure: 'LAX route turbulence; FRA handling avoided', expectedArrival: '17 Oct, 11:30', delayHours: 6, cost: 780, totalExpectedLoss: 0, feasibility: 82, networkImpact: 'Lower-impact cargo is deferred; 720 kg becomes exposed.', explanation: 'Higher handling cost protects the time-sensitive portion of the group.' },
  { id: 'R-289-04', caseId: 'RC-289-FRA', shipmentId: 'CX-483117', original: 'SIN → FRA · CX289', alternative: 'SIN → HKG → FRA', alternativeFlight: 'CX840 + partner connection', usableCapacityKg: 900, capacityStatus: 'Capacity confirmation pending', fuelConstraint: 'HKG payload plan pending', weatherExposure: 'HKG connection congestion possible', expectedArrival: '17 Oct, 18:00', delayHours: 13, cost: 450, totalExpectedLoss: 0, feasibility: 55, networkImpact: 'Downstream effect unknown pending connection confirmation.', explanation: 'Reasonable route on paper, but confirmation is required before review approval.' },
  { id: 'R-289-05', caseId: 'RC-289-FRA', shipmentId: 'CX-483117', original: 'SIN → FRA · CX289', alternative: 'SIN → LHR → FRA', alternativeFlight: 'CX257 + partner connection', usableCapacityKg: 700, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'LHR uplift reduces available payload', weatherExposure: 'LHR low visibility', expectedArrival: '18 Oct, 03:00', delayHours: 22, cost: 190, totalExpectedLoss: 0, feasibility: 38, networkImpact: 'Capacity shortfall exposes the shipment.', explanation: 'Low cost cannot offset the hard capacity and service constraints.' },
  { id: 'R-840-01', caseId: 'RC-840-JFK', shipmentId: 'CX-482630', original: 'HKG → JFK · CX840', alternative: 'HKG → YVR → JFK', alternativeFlight: 'CX888 + partner connection', usableCapacityKg: 800, capacityStatus: 'Confirmed', fuelConstraint: 'YVR fuel plan confirmed', weatherExposure: 'YVR clear; JFK clear', expectedArrival: '17 Oct, 13:00', delayHours: 3, cost: 980, totalExpectedLoss: 0, feasibility: 93, networkImpact: 'No displaced cargo identified.', explanation: 'Higher cost protects the timed delivery commitment.' },
  { id: 'R-840-02', caseId: 'RC-840-JFK', shipmentId: 'CX-482630', original: 'HKG → JFK · CX840', alternative: 'Later direct HKG → JFK', alternativeFlight: 'CX842 later departure', usableCapacityKg: 900, capacityStatus: 'Confirmed', fuelConstraint: 'Later aircraft fuel plan confirmed', weatherExposure: 'JFK clear', expectedArrival: '17 Oct, 19:00', delayHours: 9, cost: 300, totalExpectedLoss: 0, feasibility: 90, networkImpact: 'No downstream displacement identified.', explanation: 'Lower recovery cost, but it misses the preferred service window.' },
  { id: 'R-840-03', caseId: 'RC-840-JFK', shipmentId: 'CX-482630', original: 'HKG → JFK · CX840', alternative: 'HKG → ANC → JFK', alternativeFlight: 'CX889 + partner connection', usableCapacityKg: 700, capacityStatus: 'Capacity confirmation pending', fuelConstraint: 'ANC payload plan pending', weatherExposure: 'ANC cold-chain handling confirmation pending', expectedArrival: '17 Oct, 16:30', delayHours: 7, cost: 620, totalExpectedLoss: 0, feasibility: 58, networkImpact: 'Network impact unknown pending partner confirmation.', explanation: 'Potentially meets the deadline, but the required handling confirmation is missing.' },
  { id: 'R-840-04', caseId: 'RC-840-JFK', shipmentId: 'CX-482630', original: 'HKG → JFK · CX840', alternative: 'HKG → LAX → JFK', alternativeFlight: 'CX880 + partner connection', usableCapacityKg: 500, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'LAX fuel uplift reduces payload', weatherExposure: 'LAX turbulence may delay transfer', expectedArrival: '18 Oct, 04:00', delayHours: 28, cost: 260, totalExpectedLoss: 0, feasibility: 25, networkImpact: 'Capacity shortfall exposes high-value cargo.', explanation: 'Low cost does not satisfy the timed delivery constraint.' },
  { id: 'R-840-05', caseId: 'RC-840-JFK', shipmentId: 'CX-482630', original: 'HKG → JFK · CX840', alternative: 'HKG → NRT → JFK', alternativeFlight: 'CX500 + partner connection', usableCapacityKg: 750, capacityStatus: 'Confirmed', fuelConstraint: 'NRT fuel plan confirmed', weatherExposure: 'NRT clear; JFK clear', expectedArrival: '17 Oct, 15:30', delayHours: 5, cost: 760, totalExpectedLoss: 0, feasibility: 86, networkImpact: 'May consume 600 kg of NRT onward buffer.', explanation: 'Balanced alternative with moderate network cost and acceptable arrival.' },
  { id: 'R-PER-01', caseId: 'RC-PERISHABLE-01', shipmentId: 'RC-PERISHABLE-CARGO', original: 'HKG → LAX · CX880', alternative: 'HKG → LAX direct priority', alternativeFlight: 'CX881 priority departure', usableCapacityKg: 800, capacityStatus: 'Confirmed', fuelConstraint: 'Cold-chain fuel plan confirmed', weatherExposure: 'LAX clear; handling slot reserved in demo', expectedArrival: '17 Oct, 20:00', delayHours: 2, cost: 920, totalExpectedLoss: 0, feasibility: 94, networkImpact: 'No displaced cargo identified.', explanation: 'Fastest feasible option preserves the remaining perishable delivery window.' },
  { id: 'R-PER-02', caseId: 'RC-PERISHABLE-01', shipmentId: 'RC-PERISHABLE-CARGO', original: 'HKG → LAX · CX880', alternative: 'HKG → YVR → LAX', alternativeFlight: 'CX888 + partner connection', usableCapacityKg: 800, capacityStatus: 'Confirmed', fuelConstraint: 'YVR fuel plan confirmed', weatherExposure: 'YVR clear; additional cold-chain handoff', expectedArrival: '18 Oct, 06:30', delayHours: 12, cost: 480, totalExpectedLoss: 0, feasibility: 86, networkImpact: 'Additional handling risk; no displaced cargo identified.', explanation: 'Lower cost but leaves little remaining handling buffer.' },
  { id: 'R-PER-03', caseId: 'RC-PERISHABLE-01', shipmentId: 'RC-PERISHABLE-CARGO', original: 'HKG → LAX · CX880', alternative: 'Later direct HKG → LAX', alternativeFlight: 'CX882 later departure', usableCapacityKg: 900, capacityStatus: 'Confirmed', fuelConstraint: 'Later flight fuel plan confirmed', weatherExposure: 'LAX handling slot uncertain', expectedArrival: '18 Oct, 10:30', delayHours: 16, cost: 260, totalExpectedLoss: 0, feasibility: 45, networkImpact: 'No displaced cargo identified.', explanation: 'Low cost, but expected arrival exceeds the mandatory perishable cut-off.' },
  { id: 'R-PER-04', caseId: 'RC-PERISHABLE-01', shipmentId: 'RC-PERISHABLE-CARGO', original: 'HKG → LAX · CX880', alternative: 'HKG → NRT → LAX', alternativeFlight: 'CX500 + partner connection', usableCapacityKg: 700, capacityStatus: 'Capacity confirmation pending', fuelConstraint: 'NRT cold-chain fuel plan pending', weatherExposure: 'NRT connection risk remains unresolved', expectedArrival: '18 Oct, 08:30', delayHours: 14, cost: 610, totalExpectedLoss: 0, feasibility: 58, networkImpact: 'Network impact unknown until NRT acceptance is confirmed.', explanation: 'Could meet the cut-off, but handling confirmation is required.' },
  { id: 'R-PER-05', caseId: 'RC-PERISHABLE-01', shipmentId: 'RC-PERISHABLE-CARGO', original: 'HKG → LAX · CX880', alternative: 'HKG → SEA → LAX', alternativeFlight: 'CX700 + partner connection', usableCapacityKg: 650, capacityStatus: 'Nominal / weather constrained', fuelConstraint: 'SEA fuel uplift may reduce payload', weatherExposure: 'SEA ramp congestion', expectedArrival: '18 Oct, 13:00', delayHours: 19, cost: 390, totalExpectedLoss: 0, feasibility: 30, networkImpact: 'Capacity shortfall exposes the perishable shipment.', explanation: 'Fails the mandatory delivery window despite a modest recovery cost.' },
]

export const offloadLifecycleRecords: OffloadLifecycleRecord[] = [
  { id: 'OL-CX257-20261016', flightId: 'CX257', shipmentIds: ['CX-482901'], state: 'OFFLOAD_CONFIRMED', recoveryCaseId: 'RC-257-LHR', authoritativeSource: 'authorized-decision', statusLabel: 'Offload committed - recovery required', recordedAt: '16 Oct 2026 09:12 UTC', simulated: true, transitionHistory: ['AT_RISK at 08:45 UTC', 'Authorized pre-departure offload decision at 09:12 UTC'] },
  { id: 'OL-CX288-20261016', flightId: 'CX288', shipmentIds: ['RC-288-CARGO'], state: 'RECOVERY_IN_PROGRESS', recoveryCaseId: 'RC-288-HKG', authoritativeSource: 'operational-event', statusLabel: 'Recovery in progress', recordedAt: '16 Oct 2026 08:55 UTC', simulated: true, transitionHistory: ['OFFLOAD_CONFIRMED after original flight cancellation', 'Recovery case opened at 08:55 UTC'] },
  { id: 'OL-CX289-20261016', flightId: 'CX289', shipmentIds: ['CX-483117'], state: 'PREVENTIVE_ACTION_REQUIRED', authoritativeSource: 'forecast', statusLabel: 'Preventive action required', recordedAt: '16 Oct 2026 09:10 UTC', simulated: true, transitionHistory: ['AT_RISK from latest fuel and weather forecast'] },
  { id: 'OL-CX880-20261017', flightId: 'CX880', shipmentIds: ['CX-482774'], state: 'AT_RISK', authoritativeSource: 'forecast', statusLabel: 'Predicted risk - offload not confirmed', recordedAt: '16 Oct 2026 09:10 UTC', simulated: true, transitionHistory: ['AT_RISK from route weather forecast'] },
  { id: 'OL-CX840-20261016', flightId: 'CX840', shipmentIds: ['CX-482630'], state: 'ON_TRACK', authoritativeSource: 'forecast', statusLabel: 'On track', recordedAt: '16 Oct 2026 09:10 UTC', simulated: true, transitionHistory: ['No material offload risk identified'] },
]

export function getOffloadLifecycleState(record: OffloadLifecycleRecord): OffloadLifecycleState {
  if (record.authoritativeSource === 'operational-event' || record.authoritativeSource === 'authorized-decision') return record.state
  return record.state === 'OFFLOAD_CONFIRMED' || record.state === 'RECOVERY_IN_PROGRESS' || record.state === 'RECOVERED' || record.state === 'CLOSED' ? 'REVIEW_REQUIRED' : record.state
}

export function getOverviewQueues(forecasts: FlightCapacityForecast[] = buildForecasts()): OverviewQueues {
  const queueItems = offloadLifecycleRecords.map((lifecycle) => {
    const forecast = forecasts.find((item) => item.flightId === lifecycle.flightId)
    const recoveryCase = lifecycle.recoveryCaseId ? recoveryCases.find((item) => item.id === lifecycle.recoveryCaseId) : undefined
    const estimatedImpact = forecast?.valueAtRisk ?? shipments.filter((shipment) => lifecycle.shipmentIds.includes(shipment.id)).reduce((sum, shipment) => sum + shipment.cargoImpact * shipment.offloadProbability, 0)
    return { lifecycle, forecast, recoveryCase, estimatedImpact }
  })
  return {
    preventive: queueItems.filter((item) => item.lifecycle.state === 'AT_RISK' || item.lifecycle.state === 'PREVENTIVE_ACTION_REQUIRED'),
    recovery: queueItems.filter((item) => item.lifecycle.state === 'OFFLOAD_CONFIRMED' || item.lifecycle.state === 'RECOVERY_IN_PROGRESS'),
    onTrack: queueItems.filter((item) => item.lifecycle.state === 'ON_TRACK' || item.lifecycle.state === 'RECOVERED' || item.lifecycle.state === 'CLOSED'),
    review: queueItems.filter((item) => getOffloadLifecycleState(item.lifecycle) === 'REVIEW_REQUIRED'),
  }
}

export function getOverviewMetrics(queues: OverviewQueues, forecasts: FlightCapacityForecast[] = buildForecasts()): OverviewMetrics {
  const attentionShipmentIds = new Set([...queues.preventive, ...queues.recovery].flatMap((item) => item.lifecycle.shipmentIds))
  const confirmedShipmentIds = new Set(queues.recovery.flatMap((item) => item.lifecycle.shipmentIds))
  const activeCaseIds = new Set(queues.recovery.flatMap((item) => item.lifecycle.recoveryCaseId ? [item.lifecycle.recoveryCaseId] : []))
  return {
    upcomingFlights: forecasts.length + queues.recovery.filter((item) => !forecasts.some((flight) => flight.flightId === item.lifecycle.flightId)).length,
    flightsAtRisk: new Set(queues.preventive.map((item) => item.lifecycle.flightId)).size,
    predictedOffloads: queues.preventive.reduce((sum, item) => sum + (item.forecast?.affectedShipments ?? 0), 0),
    confirmedOffloads: confirmedShipmentIds.size,
    shipmentsRequiringAttention: attentionShipmentIds.size,
    activeRecoveryCases: activeCaseIds.size,
  }
}

export function getLifecycleDestination(state: OffloadLifecycleState): 'Predictions' | 'Recovery Plans' | 'Overview' {
  if (state === 'OFFLOAD_CONFIRMED' || state === 'RECOVERY_IN_PROGRESS') return 'Recovery Plans'
  if (state === 'AT_RISK' || state === 'PREVENTIVE_ACTION_REQUIRED') return 'Predictions'
  return 'Overview'
}

export function evaluateRecoveryPlans(options: RecoveryOption[] = recoveryOptions): RecoveryEvaluation[] {
  const evaluated: RecoveryEvaluation[] = options.map((option) => {
    const shipment = shipments.find((item) => item.id === option.shipmentId) ?? recoveryShipmentContexts[option.shipmentId]
    const isFeasible = shipment ? option.capacityStatus !== 'Capacity confirmation pending' && option.usableCapacityKg >= shipment.weightKg && option.feasibility >= 70 : false
    const missingData = option.capacityStatus === 'Nominal / weather constrained' ? ['Downstream confirmed payload after weather update'] : option.capacityStatus === 'Capacity confirmation pending' ? ['Alternative capacity and latest fuel plan require confirmation'] : []
    const alternativeFlightId = option.alternativeFlight.split(' ')[0]
    const alternativeForecast = buildForecasts().find((forecast) => forecast.flightId === alternativeFlightId)
    const alternativeShipments = shipments.filter((item) => item.flightId === alternativeFlightId)
    const availableBeforeRecovery = alternativeForecast ? Math.max(0, alternativeForecast.forecastCargoCapacity - alternativeForecast.forecastBookedWeight) : 0
    const networkShortfallKg = Math.max(0, option.usableCapacityKg - availableBeforeRecovery)
    const additionalAffectedShipments = alternativeShipments.filter((item) => item.weightKg <= networkShortfallKg).map((item) => item.id)
    const downstreamImpact = option.networkImpact.toLowerCase().includes('uncertain') || networkShortfallKg > 0 ? networkShortfallKg * 2 : 0
    const cargoCustomerImpact = shipment ? Math.round(shipment.cargoImpact * (option.delayHours / 12)) : 0
    const cathayContributionImpact = shipment?.cathayImpact ?? 0
    const delayAndServiceImpact = option.delayHours * 350
    const totalExpectedLoss = cargoCustomerImpact + cathayContributionImpact + option.cost + delayAndServiceImpact + downstreamImpact + (option.scenarioAdjustment ?? 0)
    const costBreakdown: RecoveryCostBreakdown = { cargoCustomerImpact, cathayContributionImpact, recoveryAndHandlingCost: option.cost, delayAndServiceImpact, downstreamNetworkImpact: downstreamImpact, totalExpectedLoss }
    return { option, recommendationVersion: 'recovery-heuristic-v3', optimizationStatus: isFeasible ? 'HEURISTIC_SUGGESTION' : 'NO_FEASIBLE_PLAN', isFeasible, affectedFlights: [option.original.split(' · ')[1] ?? option.original, option.alternativeFlight], affectedShipments: [option.shipmentId], costBreakdown, objectiveDefinition: 'Minimize total expected loss across affected flights while satisfying hard operational constraints.', objectiveWeights: { cargoCustomerImpact: 1, cathayContributionImpact: 1, recoveryAndHandlingCost: 1, delayAndServiceImpact: 1, downstreamNetworkImpact: 1 }, hardConstraints: ['Usable capacity must cover shipment weight.', 'Required fuel and weather constraints cannot be relaxed.', 'Connection and cargo compatibility must be confirmed or explicitly qualified.', 'Delivery commitment must be met for time-sensitive cargo.'], rejectedReasons: isFeasible ? [] : [option.capacityStatus === 'Capacity confirmation pending' ? 'Feasibility unknown: capacity and fuel confirmation are pending.' : `Rejected: ${formatKg(option.usableCapacityKg)} usable capacity is below the shipment weight of ${formatKg(shipment?.weightKg ?? 0)} or a mandatory constraint is not met.`], alternativesConsidered: options.filter((candidate) => candidate.id !== option.id).map((candidate) => candidate.id), assumptions: ['Demo payload and loss inputs are simulated.', 'Heuristic candidate comparison does not establish global optimality.', 'Downstream capacity is inferred from the forecast buffer and requires operational confirmation.'], missingData, predictionTimestamp: '16 Oct 2026 09:10 UTC', optimizationTimestamp: '16 Oct 2026 09:12 UTC', optimalityGap: null, terminationReason: 'Candidate enumeration completed; no solver optimality proof available.', deliveryCommitmentFeasible: shipment ? option.expectedArrival.includes('05:40') || option.expectedArrival.includes('17 Oct') && !option.expectedArrival.includes('13:30') && !option.expectedArrival.includes('18 Oct') : null, networkShortfallKg, additionalAffectedShipments }
  })
  const feasible = evaluated.filter((evaluation) => evaluation.isFeasible).sort((a, b) => a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss)
  const selectedId = feasible[0]?.option.id
  return evaluated.map((evaluation) => evaluation.isFeasible && evaluation.option.id === selectedId ? { ...evaluation, optimizationStatus: 'BEST_FEASIBLE_FOUND' } : evaluation).sort((a, b) => {
    if (a.isFeasible !== b.isFeasible) return a.isFeasible ? -1 : 1
    return a.costBreakdown.totalExpectedLoss - b.costBreakdown.totalExpectedLoss
  })
}

export function evaluateRecoveryScenario(scenario: RecoveryScenario, options: RecoveryOption[] = recoveryOptions): RecoveryEvaluation[] {
  const scenarioOptions = options.map((option) => {
    if (scenario === 'no-intervention') return { ...option, usableCapacityKg: 0, capacityStatus: 'Nominal / weather constrained' as const, feasibility: 0, scenarioAdjustment: 23320, explanation: 'No intervention is applied; the shipment remains exposed to the original disruption.' }
    if (scenario === 'preventive') return { ...option, scenarioAdjustment: -Math.round(evaluateRecoveryPlans([option])[0].costBreakdown.totalExpectedLoss * 0.18), feasibility: Math.min(100, option.feasibility + 5), explanation: 'Preventive capacity and handling actions reduce the modeled disruption exposure.' }
    return option
  })
  return evaluateRecoveryPlans(scenarioOptions)
}

export function evaluateRecoverySensitivity(optionId: string): Array<{ label: string; evaluation: RecoveryEvaluation }> {
  const option = recoveryOptions.find((candidate) => candidate.id === optionId)
  if (!option) return []
  return [
    { label: 'Current inputs', evaluation: evaluateRecoveryPlans([option])[0] },
    { label: 'Fuel estimate +600 kg', evaluation: evaluateRecoveryPlans([{ ...option, usableCapacityKg: Math.max(0, option.usableCapacityKg - 600), fuelConstraint: `${option.fuelConstraint}; +600 kg fuel sensitivity` }])[0] },
    { label: 'Weather capacity -600 kg', evaluation: evaluateRecoveryPlans([{ ...option, usableCapacityKg: Math.max(0, option.usableCapacityKg - 600), weatherExposure: `${option.weatherExposure}; capacity sensitivity applied` }])[0] },
    { label: 'Alternative unavailable', evaluation: evaluateRecoveryPlans([{ ...option, usableCapacityKg: 0, feasibility: 0, capacityStatus: 'Nominal / weather constrained' }])[0] },
  ]
}

export function recordRecoveryDecision(decision: RecoveryDecision): RecoveryDecision {
  const key = 'cargo-recovery-decisions'
  if (typeof localStorage !== 'undefined') {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as RecoveryDecision[]
    localStorage.setItem(key, JSON.stringify([...existing, decision]))
  }
  return decision
}

export function explainRecoveryEvaluation(evaluation: RecoveryEvaluation): string[] {
  const { option, costBreakdown } = evaluation
  if (!evaluation.isFeasible) return [`${option.id} is rejected because it violates a hard capacity constraint.`, ...evaluation.rejectedReasons, 'It was not compared as a valid business alternative.']
  const selectionReason = evaluation.optimizationStatus === 'BEST_FEASIBLE_FOUND' ? 'It is the best feasible plan found in the current heuristic candidate set.' : 'It is a feasible heuristic suggestion, but it was not selected as the best candidate in the current set.'
  return [`${option.id}: ${selectionReason} Modeled total expected loss is ${formatCurrency(costBreakdown.totalExpectedLoss)}.`, `It provides ${formatKg(option.usableCapacityKg)} usable capacity and is estimated at ${option.feasibility}% feasible.`, `The trade-off is ${formatCurrency(option.cost)} recovery cost and ${option.delayHours} hours of delay.`, option.networkImpact, 'Optimality has not been proved; a validated optimization solver and confirmed downstream capacity are still required.']
}

export function formatCurrency(value: number): string { return `USD ${Math.round(value).toLocaleString()}` }
export function formatKg(value: number): string { return `${Math.round(value).toLocaleString()} kg` }
export function getWeather(flightId: string): WeatherRiskAssessment { return weatherAssessments.find((item) => item.flightId === flightId)! }

export const demoReportingPeriod: ReportingPeriod = { label: 'Previous 24 hours', start: '2026-10-15T09:00:00Z', end: '2026-10-16T09:00:00Z', timezone: 'UTC' }

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function aggregateForecastOffloadRate(forecasts: FlightCapacityForecast[], shipmentPopulation: Shipment[] = shipments): number | null {
  const eligibleShipments = forecasts.flatMap((forecast) => shipmentPopulation.filter((shipment) => shipment.flightId === forecast.flightId))
  if (!eligibleShipments.length) return null
  const predictedOffloadedShipments = forecasts.reduce((total, forecast) => total + shipmentPopulation.filter((shipment) => shipment.flightId === forecast.flightId).length * forecast.predictedOffloadRate, 0)
  return predictedOffloadedShipments / eligibleShipments.length
}

export function calculateOffloadMetrics(input: { actualOffloadedShipments: number; eligibleShipments: number; predictedOffloadedShipments: number; forecastShipmentsConsidered: number; flightsWithOffload: number; eligibleFlights: number; reportingPeriod?: ReportingPeriod }): OffloadMetrics {
  return { actualOffloadRate: rate(input.actualOffloadedShipments, input.eligibleShipments), actualOffloadedShipments: input.actualOffloadedShipments, eligibleShipments: input.eligibleShipments, predictedOffloadRate: rate(input.predictedOffloadedShipments, input.forecastShipmentsConsidered), predictedOffloadedShipments: input.predictedOffloadedShipments, forecastShipmentsConsidered: input.forecastShipmentsConsidered, flightOffloadProbability: rate(input.flightsWithOffload, input.eligibleFlights), reportingPeriod: input.reportingPeriod ?? demoReportingPeriod }
}

export const demoOffloadMetrics = calculateOffloadMetrics({ actualOffloadedShipments: 42, eligibleShipments: 1000, predictedOffloadedShipments: 87, forecastShipmentsConsidered: 1000, flightsWithOffload: 2, eligibleFlights: 4 })

export const demoOutcomes: OffloadOutcome[] = [
  { flightId: 'CX257', route: 'HKG-LHR', category: 'Pharmaceuticals', predictedOffload: true, actualOffload: true, predictedRate: 0.33, actualRate: 0.28, valueAtRisk: 36120, realisedLoss: 8200, interventionApplied: false },
  { flightId: 'CX289', route: 'SIN-FRA', category: 'General cargo', predictedOffload: false, actualOffload: true, predictedRate: 0.14, actualRate: 0.19, valueAtRisk: 4968, realisedLoss: 2100, interventionApplied: false },
  { flightId: 'CX880', route: 'HKG-LAX', category: 'General cargo', predictedOffload: true, actualOffload: false, predictedRate: 0.09, actualRate: 0, valueAtRisk: 616, realisedLoss: 0, interventionApplied: true },
  { flightId: 'CX840', route: 'HKG-JFK', category: 'High value', predictedOffload: false, actualOffload: false, predictedRate: 0.03, actualRate: 0, valueAtRisk: 168, realisedLoss: 0, interventionApplied: true },
]

export const demoOffloadTrend: OffloadTrendPoint[] = [
  { departureDate: '2026-10-13', flightId: 'CX257', route: 'HKG-LHR', metric: 'shipment', isFuture: false, actualRate: 0.042, predictedRate: 0.051, eligibleCount: 240, actualOffloadCount: 10, predictionTimestamp: '2026-10-12T18:40:00Z', forecastLeadHours: 24, confidenceLower: null, confidenceUpper: null },
  { departureDate: '2026-10-14', flightId: 'CX289', route: 'SIN-FRA', metric: 'shipment', isFuture: false, actualRate: 0.061, predictedRate: 0.058, eligibleCount: 196, actualOffloadCount: 12, predictionTimestamp: '2026-10-13T21:15:00Z', forecastLeadHours: 24, confidenceLower: null, confidenceUpper: null },
  { departureDate: '2026-10-15', flightId: 'CX880', route: 'HKG-LAX', metric: 'shipment', isFuture: false, actualRate: 0.028, predictedRate: 0.035, eligibleCount: 214, actualOffloadCount: 6, predictionTimestamp: '2026-10-14T02:05:00Z', forecastLeadHours: 24, confidenceLower: null, confidenceUpper: null },
  { departureDate: '2026-10-16', flightId: 'CX840', route: 'HKG-JFK', metric: 'shipment', isFuture: true, actualRate: null, predictedRate: 0.033, eligibleCount: 188, actualOffloadCount: null, predictionTimestamp: '2026-10-15T23:50:00Z', forecastLeadHours: 24, confidenceLower: null, confidenceUpper: null },
  { departureDate: '2026-10-17', flightId: 'CX257', route: 'HKG-LHR', metric: 'shipment', isFuture: true, actualRate: null, predictedRate: 0.055, eligibleCount: 232, actualOffloadCount: null, predictionTimestamp: '2026-10-16T18:40:00Z', forecastLeadHours: 24, confidenceLower: null, confidenceUpper: null },
]

export function filterOffloadTrend(points: OffloadTrendPoint[], options: { route?: string; days?: number; metric?: TrendMetric }): OffloadTrendPoint[] {
  const metric = options.metric ?? 'shipment'
  const sorted = points.filter((point) => (!options.route || options.route === 'All routes' || point.route === options.route) && point.metric === metric).sort((a, b) => a.departureDate.localeCompare(b.departureDate))
  return options.days ? sorted.slice(-options.days) : sorted
}

export function summarizeAnalytics(outcomes: OffloadOutcome[] = demoOutcomes): AnalyticsSummary {
  const predicted = outcomes.filter((outcome) => outcome.predictedOffload).length
  const actual = outcomes.filter((outcome) => outcome.actualOffload).length
  const falseAlarms = outcomes.filter((outcome) => outcome.predictedOffload && !outcome.actualOffload).length
  const misses = outcomes.filter((outcome) => !outcome.predictedOffload && outcome.actualOffload).length
  const interventions = outcomes.filter((outcome) => outcome.interventionApplied)
  const interventionSuccesses = interventions.filter((outcome) => !outcome.actualOffload).length
  const meanAbsoluteProbabilityError = outcomes.length ? outcomes.reduce((sum, outcome) => sum + Math.abs(outcome.predictedRate - outcome.actualRate), 0) / outcomes.length : null
  const leadTimes = outcomes.flatMap((outcome) => outcome.forecastLeadHours === undefined ? [] : [outcome.forecastLeadHours])
  return { predictedRate: rate(predicted, outcomes.length) ?? 0, actualRate: rate(actual, outcomes.length) ?? 0, falseAlarmRate: rate(falseAlarms, predicted) ?? 0, missedOffloadRate: rate(misses, actual) ?? 0, estimatedValueAtRisk: outcomes.reduce((sum, outcome) => sum + outcome.valueAtRisk, 0), realisedLoss: outcomes.reduce((sum, outcome) => sum + outcome.realisedLoss, 0), interventionCount: interventions.length, interventionSuccessRate: rate(interventionSuccesses, interventions.length) ?? 0, leadTimeHours: leadTimes.length ? leadTimes.reduce((sum, hours) => sum + hours, 0) / leadTimes.length : null, sampleSize: outcomes.length, sufficientSample: outcomes.length >= 30, falseAlarm: { numerator: falseAlarms, denominator: predicted, rate: rate(falseAlarms, predicted) }, missedOffload: { numerator: misses, denominator: actual, rate: rate(misses, actual) }, interventionSuccess: { numerator: interventionSuccesses, denominator: interventions.length, rate: rate(interventionSuccesses, interventions.length) }, meanAbsoluteProbabilityError, flightRateError: meanAbsoluteProbabilityError, businessImpactDataAvailable: outcomes.some((outcome) => outcome.realisedLoss > 0), recoveryCostDataAvailable: false }
}
