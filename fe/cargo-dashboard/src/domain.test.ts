import { describe, expect, it } from 'vitest'
import { aggregateForecastOffloadRate, assessShipmentValue, buildForecasts, calculateOffloadMetrics, calculatePotentialLossAvoidable, demoOffloadMetrics, demoOffloadTrend, evaluateRecoveryPlans, evaluateRecoveryScenario, evaluateRecoverySensitivity, filterOffloadTrend, getLifecycleDestination, getOffloadLifecycleState, getOverviewMetrics, getOverviewQueues, getShipmentScenarioLoss, isConfirmedOffload, offloadLifecycleRecords, pendingPoolUnits, predictionConfig, recoveryCases, recoveryOptions, shipments, summarizeAnalytics } from './domain'

describe('offload metrics', () => {
  it('keeps actual rate, predicted rate, and flight probability distinct', () => {
    const metrics = calculateOffloadMetrics({ actualOffloadedShipments: 42, eligibleShipments: 1000, predictedOffloadedShipments: 87, forecastShipmentsConsidered: 1000, flightsWithOffload: 2, eligibleFlights: 4 })
    expect(metrics.actualOffloadRate).toBeCloseTo(0.042)
    expect(metrics.predictedOffloadRate).toBeCloseTo(0.087)
    expect(metrics.flightOffloadProbability).toBe(0.5)
    expect(metrics.eligibleShipments).toBe(1000)
  })

  it('returns unknown instead of zero when a denominator is unavailable', () => {
    const metrics = calculateOffloadMetrics({ actualOffloadedShipments: 0, eligibleShipments: 0, predictedOffloadedShipments: 0, forecastShipmentsConsidered: 0, flightsWithOffload: 0, eligibleFlights: 0 })
    expect(metrics.actualOffloadRate).toBeNull()
    expect(metrics.predictedOffloadRate).toBeNull()
    expect(metrics.flightOffloadProbability).toBeNull()
  })

  it('publishes the demo reporting period with the dashboard metrics', () => {
    expect(demoOffloadMetrics.reportingPeriod.label).toBe('Previous 24 hours')
    expect(demoOffloadMetrics.reportingPeriod.timezone).toBe('UTC')
  })
})

describe('shipment value assessment', () => {
  it('keeps declared value separate from estimated loss and Cathay impact', () => {
    const shipment = shipments[0]
    const assessment = assessShipmentValue(shipment)
    expect(shipment.declaredCargoValue).toBeGreaterThan(assessment.cargoCustomerImpact)
    expect(assessment.cathayContributionImpact).toBe(shipment.cathayImpact)
    expect(assessment.cargoCustomerImpact).not.toBe(shipment.declaredCargoValue)
    expect(assessment.lowEstimate).toBeLessThan(assessment.highEstimate)
  })

  it('keeps recovery cost separate and adds it exactly once to scenario loss', () => {
    const assessment = assessShipmentValue(shipments[0])
    expect(getShipmentScenarioLoss(assessment, 'baseline')).toBe(assessment.baselineLoss)
    expect(getShipmentScenarioLoss(assessment, 'latest') - assessment.latestScenarioLoss).toBe(assessment.recoveryCost)
    expect(getShipmentScenarioLoss(assessment, 'preventive')).toBe(assessment.preventiveScenarioLoss + assessment.recoveryCost)
    expect(assessment.cathayContributionImpact).toBe(shipments[0].cathayImpact)
  })
})

describe('analytics summary', () => {
  it('reports false alarms, misses, realized loss, and intervention success', () => {
    const summary = summarizeAnalytics()
    expect(summary.predictedRate).toBe(0.5)
    expect(summary.actualRate).toBe(0.5)
    expect(summary.falseAlarmRate).toBe(0.5)
    expect(summary.missedOffloadRate).toBe(0.5)
    expect(summary.realisedLoss).toBe(10300)
    expect(summary.interventionSuccessRate).toBe(1)
    expect(summary.falseAlarm).toEqual({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(summary.missedOffload).toEqual({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(summary.interventionSuccess).toEqual({ numerator: 2, denominator: 2, rate: 1 })
    expect(summary.sufficientSample).toBe(false)
    expect(summary.meanAbsoluteProbabilityError).toBeGreaterThan(0)
    expect(summary.meanAbsoluteProbabilityError).toBeCloseTo(0.055)
    expect(summary.flightRateError).toBeCloseTo(0.03)
    expect(summary.flightRateError).not.toBe(summary.meanAbsoluteProbabilityError)
    expect(summary.leadTimeHours).toBeNull()
  })
})

describe('recovery optimization evidence', () => {
  const cx257Options = recoveryOptions.filter((option) => option.caseId === 'RC-257-LHR')

  it('rejects an alternative that violates usable payload capacity', () => {
    const evaluation = evaluateRecoveryPlans(cx257Options).find((item) => item.option.id === 'R-257-01')!
    expect(evaluation.isFeasible).toBe(false)
    expect(evaluation.optimizationStatus).toBe('NO_FEASIBLE_PLAN')
    expect(evaluation.rejectedReasons[0]).toContain('below the shipment weight')
  })

  it('selects the lowest-loss feasible candidate without claiming optimality', () => {
    const evaluations = evaluateRecoveryPlans(cx257Options)
    const feasible = evaluations.filter((item) => item.isFeasible)
    expect(feasible).toHaveLength(2)
    expect(feasible[0].option.id).toBe('R-257-02')
    expect(feasible[0].optimizationStatus).toBe('BEST_FEASIBLE_FOUND')
    expect(feasible[0].optimalityGap).toBeNull()
  })

  it('keeps downstream network impact as a separate modeled component', () => {
    const evaluation = evaluateRecoveryPlans(recoveryOptions).find((item) => item.option.id === 'R-257-01')!
    expect(evaluation.costBreakdown.downstreamNetworkImpact).toBeGreaterThan(0)
    expect(evaluation.costBreakdown.totalExpectedLoss).toBe(evaluation.costBreakdown.cargoCustomerImpact + evaluation.costBreakdown.cathayContributionImpact + evaluation.costBreakdown.recoveryAndHandlingCost + evaluation.costBreakdown.delayAndServiceImpact + evaluation.costBreakdown.downstreamNetworkImpact)
    expect(shipments.some((shipment) => shipment.id === evaluation.affectedShipments[0])).toBe(true)
  })

  it('reevaluates candidates for each decision scenario', () => {
    const baseline = evaluateRecoveryScenario('recover', cx257Options)
    const preventive = evaluateRecoveryScenario('preventive', cx257Options)
    const noIntervention = evaluateRecoveryScenario('no-intervention', cx257Options)
    const baselineOption = baseline.find((item) => item.option.id === 'R-257-02')!
    const preventiveOption = preventive.find((item) => item.option.id === 'R-257-02')!
    expect(preventiveOption.costBreakdown.totalExpectedLoss).not.toBe(baselineOption.costBreakdown.totalExpectedLoss)
    expect(noIntervention.every((evaluation) => !evaluation.isFeasible)).toBe(true)
    expect(noIntervention[0].optimizationStatus).toBe('NO_FEASIBLE_PLAN')
  })

  it('distinguishes the selected best feasible plan from heuristic feasible suggestions', () => {
    const evaluations = evaluateRecoveryPlans(cx257Options)
    expect(evaluations.find((item) => item.option.id === 'R-257-02')?.optimizationStatus).toBe('BEST_FEASIBLE_FOUND')
    expect(evaluations.find((item) => item.option.id === 'R-257-01')?.optimizationStatus).toBe('NO_FEASIBLE_PLAN')
  })

  it('keeps alternatives attached to the same recovery case', () => {
    expect(recoveryCases).toHaveLength(5)
    expect(new Set(recoveryOptions.map((option) => option.caseId)).size).toBe(5)
    for (const recoveryCase of recoveryCases) {
      const options = recoveryOptions.filter((option) => option.caseId === recoveryCase.id)
      expect(options.length).toBeGreaterThanOrEqual(3)
      expect(options.every((option) => recoveryCase.affectedShipmentIds.includes(option.shipmentId))).toBe(true)
    }
  })

  it('never recommends an infeasible candidate', () => {
    const evaluations = evaluateRecoveryScenario('recover', cx257Options)
    const recommended = evaluations.find((item) => item.optimizationStatus === 'BEST_FEASIBLE_FOUND')
    expect(recommended?.isFeasible).toBe(true)
    expect(evaluations.find((item) => !item.isFeasible)?.optimizationStatus).toBe('NO_FEASIBLE_PLAN')
  })

  it('recalculates total loss when the scenario changes', () => {
    const baseline = evaluateRecoveryScenario('recover', cx257Options).find((item) => item.option.id === 'R-257-02')!
    const preventive = evaluateRecoveryScenario('preventive', cx257Options).find((item) => item.option.id === 'R-257-02')!
    expect(preventive.costBreakdown.totalExpectedLoss).not.toBe(baseline.costBreakdown.totalExpectedLoss)
    expect(preventive.costBreakdown.totalExpectedLoss).toBe(
      preventive.costBreakdown.cargoCustomerImpact +
      preventive.costBreakdown.cathayContributionImpact +
      preventive.costBreakdown.recoveryAndHandlingCost +
      preventive.costBreakdown.delayAndServiceImpact +
      preventive.costBreakdown.downstreamNetworkImpact +
      (preventive.option.scenarioAdjustment ?? 0),
    )
  })

  it('labels heuristic comparison honestly', () => {
    const evaluation = evaluateRecoveryScenario('recover').find((item) => item.isFeasible)!
    expect(evaluation.optimizationStatus).toBe('BEST_FEASIBLE_FOUND')
    expect(evaluation.terminationReason).toContain('no solver optimality proof')
    expect(evaluation.optimalityGap).toBeNull()
  })

  it('keeps every displayed loss equal to its visible components', () => {
    for (const recoveryCase of recoveryCases) {
      for (const evaluation of evaluateRecoveryScenario('recover', recoveryOptions.filter((option) => option.caseId === recoveryCase.id))) {
        const breakdown = evaluation.costBreakdown
        expect(breakdown.totalExpectedLoss).toBe(breakdown.cargoCustomerImpact + breakdown.cathayContributionImpact + breakdown.recoveryAndHandlingCost + breakdown.delayAndServiceImpact + breakdown.downstreamNetworkImpact + (evaluation.option.scenarioAdjustment ?? 0))
      }
    }
  })

  it('does not treat pending capacity as feasible', () => {
    const pendingOptions = recoveryOptions.filter((option) => option.capacityStatus === 'Capacity confirmation pending')
    expect(pendingOptions.length).toBeGreaterThan(0)
    expect(evaluateRecoveryPlans(pendingOptions).every((evaluation) => !evaluation.isFeasible && evaluation.missingData.length > 0)).toBe(true)
  })

  it('returns sensitivity evaluations for supported recovery input changes', () => {
    const sensitivity = evaluateRecoverySensitivity('R-257-02')
    expect(sensitivity.map((item) => item.label)).toEqual(['Current inputs', 'Fuel estimate +600 kg', 'Weather capacity -600 kg', 'Alternative unavailable'])
    expect(sensitivity[3].evaluation.isFeasible).toBe(false)
  })
})

describe('offload lifecycle routing', () => {
  it('keeps predicted risk in its queue and confirmed cases in disruption alerts', () => {
    const queues = getOverviewQueues()
    expect(queues.preventive.map((item) => item.lifecycle.flightId)).toEqual(expect.arrayContaining(['CX289', 'CX880']))
    expect(queues.recovery.map((item) => item.lifecycle.flightId)).toEqual(expect.arrayContaining(['CX257', 'CX288']))
    expect(queues.preventive.some((item) => item.lifecycle.recoveryCaseId)).toBe(false)
    expect(queues.recovery.every((item) => isConfirmedOffload(item.lifecycle))).toBe(true)
    expect(queues.preventive.every((item) => item.lifecycle.authoritativeSource === 'forecast')).toBe(true)
  })

  it('routes lifecycle states to the corresponding priority pages', () => {
    const risk = offloadLifecycleRecords.find((record) => record.flightId === 'CX289')!
    const confirmed = offloadLifecycleRecords.find((record) => record.flightId === 'CX257')!
    expect(getOffloadLifecycleState(risk)).toBe('PREVENTIVE_ACTION_REQUIRED')
    expect(getLifecycleDestination(risk)).toBe('Predicted Offload')
    expect(getOffloadLifecycleState(confirmed)).toBe('OFFLOAD_CONFIRMED')
    expect(getLifecycleDestination(confirmed)).toBe('Disruption Alerts')
  })

  it('does not treat a forecast-only record as confirmed even if its state is inconsistent', () => {
    const forecastRecord = offloadLifecycleRecords.find((record) => record.flightId === 'CX880')!
    expect(isConfirmedOffload({ ...forecastRecord, state: 'OFFLOAD_CONFIRMED' })).toBe(false)
    expect(getLifecycleDestination({ ...forecastRecord, state: 'OFFLOAD_CONFIRMED' })).toBe('Overview')
  })

  it('keeps the pending pool limited to unique simulated domino-offload ULDs', () => {
    expect(new Set(pendingPoolUnits.map((unit) => unit.id)).size).toBe(pendingPoolUnits.length)
    expect(pendingPoolUnits.every((unit) => unit.source === 'Domino offload' && unit.simulated)).toBe(true)
    expect(pendingPoolUnits.some((unit) => unit.eligibleForNoShowReplacement)).toBe(true)
  })

  it('does not count the recovery queue as historical actual offloads', () => {
    const queues = getOverviewQueues()
    const queueShipmentIds = new Set(queues.recovery.flatMap((item) => item.lifecycle.shipmentIds))
    expect(queueShipmentIds.has('CX-482901')).toBe(true)
    expect(demoOffloadMetrics.actualOffloadedShipments).toBe(42)
  })

  it('counts overview metrics without mixing forecast risks with confirmed offloads', () => {
    const forecasts = buildForecasts()
    const queues = getOverviewQueues(forecasts)
    const metrics = getOverviewMetrics(queues, forecasts)
    expect(metrics.upcomingFlights).toBe(5)
    expect(metrics.flightsAtRisk).toBe(2)
    expect(metrics.confirmedOffloads).toBe(2)
    expect(metrics.activeRecoveryCases).toBe(2)
    expect(metrics.shipmentsRequiringAttention).toBe(4)
    expect(metrics.confirmedOffloads).not.toBe(metrics.predictedOffloads)
  })

  it('deduplicates shipments and recovery cases in overview counts', () => {
    const queues = getOverviewQueues()
    const duplicatedRecovery = { ...queues.recovery[0], lifecycle: { ...queues.recovery[0].lifecycle, shipmentIds: [...queues.recovery[0].lifecycle.shipmentIds, ...queues.recovery[0].lifecycle.shipmentIds], recoveryCaseId: queues.recovery[1].lifecycle.recoveryCaseId } }
    const metrics = getOverviewMetrics({ ...queues, recovery: [...queues.recovery, duplicatedRecovery] })
    expect(metrics.confirmedOffloads).toBe(2)
    expect(metrics.activeRecoveryCases).toBe(2)
    expect(metrics.shipmentsRequiringAttention).toBe(4)
  })
})

describe('forecast aggregation', () => {
  it('aggregates predicted rate over shipments rather than averaging flights', () => {
    const forecasts = buildForecasts()
    const shipmentPopulation = [...shipments, { ...shipments[0], id: 'CX-TEST', flightId: 'CX257' }]
    const rate = aggregateForecastOffloadRate(forecasts, shipmentPopulation)
    const expected = forecasts.reduce((total, forecast) => total + shipmentPopulation.filter((shipment) => shipment.flightId === forecast.flightId).length * forecast.predictedOffloadRate, 0) / shipmentPopulation.length
    expect(rate).toBeCloseTo(expected)
    expect(rate).not.toBeCloseTo(forecasts.reduce((total, forecast) => total + forecast.predictedOffloadRate, 0) / forecasts.length)
  })

  it('calculates avoidable loss from shipment scenario assessments', () => {
    const expected = shipments.reduce((total, shipment) => {
      const assessment = assessShipmentValue(shipment)
      const feasiblePreventiveLoss = shipment.recoveryAvailable ? assessment.preventiveScenarioLoss + assessment.recoveryCost : assessment.baselineLoss
      return total + Math.max(0, assessment.baselineLoss - feasiblePreventiveLoss)
    }, 0)
    expect(calculatePotentialLossAvoidable()).toBe(Math.round(expected))
  })

  it('documents a configurable triage threshold without calling it an approved service level', () => {
    expect(predictionConfig.highRiskProbabilityThreshold).toBeGreaterThan(0)
    expect(predictionConfig.thresholdMeaning).toContain('not an approved Cathay service level')
  })

  it('recalculates capacity and exposure when supported forecast inputs update', () => {
    const baseline = buildForecasts().find((forecast) => forecast.flightId === 'CX840')!
    const updated = buildForecasts({ CX840: { latestEstimatedFuelWeight: baseline.plannedFuelWeight + 4000 } }).find((forecast) => forecast.flightId === 'CX840')!
    expect(updated.forecastCargoCapacity).toBeLessThan(baseline.forecastCargoCapacity)
    expect(updated.forecastAdditionalFuelWeight).toBe(4000)
  })
})

describe('offload trend cohorts', () => {
  it('keeps upcoming actual outcomes missing and uses a consistent 24-hour snapshot', () => {
    const future = demoOffloadTrend.filter((point) => point.isFuture)
    expect(future.every((point) => point.actualRate === null && point.actualOffloadCount === null)).toBe(true)
    expect(new Set(demoOffloadTrend.map((point) => point.forecastLeadHours))).toEqual(new Set([24]))
    expect(demoOffloadTrend.every((point) => point.predictionTimestamp !== null)).toBe(true)
  })

  it('filters trend cohorts by route and reporting window without rebuilding snapshots', () => {
    const routePoints = filterOffloadTrend(demoOffloadTrend, { route: 'HKG-LHR', days: 5, metric: 'shipment' })
    expect(routePoints).toHaveLength(2)
    expect(routePoints.every((point) => point.route === 'HKG-LHR')).toBe(true)
    expect(routePoints[0].predictionTimestamp).toBe('2026-10-12T18:40:00Z')
  })

  it('does not silently substitute unavailable weight and volume trends', () => {
    expect(filterOffloadTrend(demoOffloadTrend, { metric: 'weight' })).toHaveLength(0)
    expect(filterOffloadTrend(demoOffloadTrend, { metric: 'volume' })).toHaveLength(0)
  })
})
