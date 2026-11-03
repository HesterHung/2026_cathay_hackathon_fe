# Prevention Plan API

This contract defines the flight-level prevention workflow. It covers forecast-risk review before an offload is confirmed.

## Conventions

- Monetary values are numeric amounts with a separate `currency`, defaulting to `HKD`.
- Weights use numeric kilograms with fields ending in `Kg`.
- Volumes use numeric cubic meters with fields ending in `M3`.
- Delays use numeric hours with fields ending in `Hours`.
- Probabilities are decimals from `0` to `1`.
- Feasibility percentages are numeric values from `0` to `100`.
- Timestamps use ISO-8601 UTC strings.
- Preventive review must not create an allocation or confirm an offload.
- `BEST_FEASIBLE_FOUND` does not mean globally optimal when `optimalityGap` is `null` and no solver proof exists.
- The current frontend uses camelCase fields, while the synthetic JSON uses snake_case such as `option_id` and `estimated_arrival`. An API adapter should normalize these before returning responses.

## 1. List Flights Requiring Preventive Review

`GET /api/v1/prevention-plans?status=AT_RISK,PREVENTIVE_ACTION_REQUIRED&page=1&limit=20`

Lists forecast-risk flights that need operator review before an offload is confirmed.

The response totals summarize the queue: `totalCases` counts flights requiring review, while `totalShipmentsAtRisk` counts unique affected shipments across those flights.

### Request query parameters

| Parameter | Type | Default | Validation | Note |
|---|---|---:|---|---|
| `status` | string | `AT_RISK,PREVENTIVE_ACTION_REQUIRED` | Comma-separated enum values | Filters the preventive queue |
| `page` | integer | `1` | Must be `>= 1` | One-based page number |
| `limit` | integer | `20` | Must be between `1` and `100` | Cases returned per page; request-only and not echoed in the response |

### Response item fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `flightId` | string | Flight number | |
| `status` | enum | `AT_RISK`, `PREVENTIVE_ACTION_REQUIRED`, `REVIEWED` | |
| `riskLevel` | enum | `Low`, `Moderate`, `High`, `Critical` | |
| `offloadProbability` | number | Decimal from `0` to `1` | |
| `predictedOffloadRate` | number | Decimal from `0` to `1` | |
| `affectedShipmentCount` | integer | Count | |
| `forecastRisk` | object | Combined forecast risk | Includes offload probability, capacity shortfall, and risk reasons; the overall status is provided at item level. |
| `valueAtRisk` | number | Currency amount | |
| `currency` | string | ISO currency code | |

### Response envelope fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `items` | object[] | Array of prevention review items | Each item follows the response item fields table above |
| `totalCases` | integer | Count | Total flights requiring preventive review across all pages |
| `totalShipmentsAtRisk` | integer | Unique count | Total unique affected shipments across all pages |
| `pagination` | object | Pagination metadata | Described in the pagination fields table below |

### Pagination fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `page` | integer | One-based page number | Current page returned |
| `totalPages` | integer | Count | Total number of available pages |
| `hasNextPage` | boolean | `true` or `false` | Whether another page is available |

### `forecastRisk` fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `offloadProbability` | number | Decimal from `0` to `1` | Estimated probability of an offload |
| `capacityShortfallKg` | number | Kilograms | Forecast cargo weight that cannot be accommodated; non-zero when capacity shortfall contributes to the risk |
| `reasons` | string[] | Text list | Factors contributing to the forecast risk |

### Example response

```json
{
  "items": [
    {
      "flightId": "CX289",
      "status": "PREVENTIVE_ACTION_REQUIRED",
      "riskLevel": "Moderate",
      "offloadProbability": 0.54,
      "predictedOffloadRate": 0.04,
      "affectedShipmentCount": 1,
      "forecastRisk": {
        "offloadProbability": 0.14,
        "capacityShortfallKg": 600,
        "reasons": ["Ground-handling delay risk from ramp thunderstorms"]
      },
      "valueAtRisk": 4968,
      "currency": "HKD"
    },
    {
      "flightId": "CX880",
      "status": "AT_RISK",
      "riskLevel": "Moderate",
      "offloadProbability": 0.08,
      "predictedOffloadRate": 0,
      "affectedShipmentCount": 1,
      "forecastRisk": {
        "offloadProbability": 0.08,
        "capacityShortfallKg": 500,
        "reasons": ["Route uncertainty and possible connection delay"]
      },
      "valueAtRisk": 616,
      "currency": "HKD"
    }
  ],
  "totalCases": 2,
  "totalShipmentsAtRisk": 2,
  "pagination": {
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

## 2. View a Selected Flight and Affected Shipments

`GET /api/v1/prevention-plans/{flightId}`

Returns the selected flight, forecast evidence, affected shipment IDs, and review context.

### Response fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `planId` | string | Review-instance ID | Identifies this selected-flight review instance |
| `currency` | string | ISO currency code | Currency used by all monetary fields in the response; default `HKD` |
| `flight` | object | Flight details | Described in the flight fields table below |
| `review` | object | Review context | Described in the review fields table below |
| `capacity` | object | Payload and booking metrics | Described in the capacity fields table below |
| `affectedShipments` | object[] | Shipment details | Each item follows the affected shipment fields table below |
| `assumptions` | string[] | Text list | Assumptions used for the forecast and review |

### Flight fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `flightId` | string | Flight number | |
| `origin` | string | IATA airport code | Departure airport |
| `destination` | string | IATA airport code | Arrival airport |
| `middleStop` | string[] | IATA airport codes | Intermediate airport stops |
| `scheduledDeparture` | string | ISO-8601 datetime | Scheduled departure time in UTC |
| `aircraftType` | string | Aircraft model | |

### Review fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `status` | enum | `AT_RISK`, `PREVENTIVE_ACTION_REQUIRED`, `REVIEWED` | Current review status |
| `riskLevel` | enum | `Low`, `Moderate`, `High`, `Critical` | Overall forecast risk level |
| `reason` | string | Text | Primary reason for the review |
| `forecastTimestamp` | string | ISO-8601 datetime | Time the forecast was generated |
| `forecastConfidence` | number | Decimal from `0` to `1` | Confidence in the forecast |

### Capacity fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `usableCapacityKg` | number | Kilograms | Forecast usable cargo capacity after known operational constraints |
| `bookedWeightKg` | number | Kilograms | Total booked cargo weight |
| `remainingCapacityKg` | number | Kilograms | Usable capacity remaining after booked cargo; can be positive even when the flight is operationally at risk |
| `bookedVolumeM3` | number | Cubic meters | Total booked cargo volume |

### Affected shipment fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `shipmentId` | string | Shipment identifier | |
| `customer` | string | Text | Customer name |
| `origin` | string | IATA airport code | Shipment origin |
| `destination` | string | IATA airport code | Shipment destination |
| `weightKg` | number | Kilograms | Shipment weight |
| `volumeM3` | number | Cubic meters | Shipment volume |
| `priority` | enum | `Critical`, `High`, `Standard` | Shipment handling priority |
| `deliveryDeadline` | string | ISO-8601 datetime | Required delivery deadline |
| `offloadProbability` | number | Decimal from `0` to `1` | Shipment-level offload probability |
| `valueAtRisk` | number | Currency amount | Estimated shipment value at risk; use the response currency |

### Example response

```json
{
  "planId": "PP-CX289-20261016",
  "currency": "HKD",
  "flight": {
    "flightId": "CX289",
    "origin": "SIN",
    "destination": "FRA",
    "middleStop": ["DOH"],
    "scheduledDeparture": "2026-10-16T21:15:00Z",
    "aircraftType": "A350-1000"
  },
  "review": {
    "status": "PREVENTIVE_ACTION_REQUIRED",
    "riskLevel": "Moderate",
    "reason": "Ramp weather and updated fuel requirement",
    "forecastTimestamp": "2026-10-16T09:10:00Z",
    "forecastConfidence": 0.71
  },
  "capacity": {
    "usableCapacityKg": 14500,
    "bookedWeightKg": 13900,
    "remainingCapacityKg": 600,
    "bookedVolumeM3": 76
  },
  "affectedShipments": [
    {
      "shipmentId": "CX-483117",
      "customer": "Helix Components",
      "origin": "SIN",
      "destination": "FRA",
      "weightKg": 980,
      "volumeM3": 5.8,
      "priority": "High",
      "deliveryDeadline": "2026-10-17T12:00:00Z",
      "offloadProbability": 0.54,
      "valueAtRisk": 4968
    }
  ],
  "assumptions": [
    "Approved payload is based on operational capacity.",
    "Weather impact remains forecast evidence.",
    "Partner capacity requires operational confirmation."
  ]
}
```

## 3. Get Preventive Options

`GET /api/v1/prevention-plans/{flightId}/options?scenario=preventive`

Generates and compares preventive alternatives for the selected flight.

| Field | Type | Unit / format |
|---|---|---|
| `optionId` | string | Unique option identifier |
| `optionType` | enum | `rebook`, `reroute`, `wait_for_next_flight`, `split` |
| `alternative` | string | Human-readable routing |
| `alternativeFlight` | string | Flight or movement |
| `feasibilityStatus` | enum | `Feasible`, `Infeasible`, `Pending` |
| `feasibilityPercentage` | number | `0` to `100` |
| `usableCapacityKg` | number | Kilograms |
| `capacityStatus` | enum | `Confirmed`, `Nominal / weather constrained`, `Capacity confirmation pending` |
| `expectedArrival` | string | ISO-8601 datetime |
| `expectedDelayHours` | number | Hours |
| `recoveryHandlingCost` | number | Currency amount |
| `totalModeledExpectedLoss` | number | Currency amount |
| `currency` | string | ISO currency code |
| `isRecommended` | boolean | Recommendation flag |
| `recommendationReason` | string | Explanation |
| `networkImpact` | string | Network impact description |

### Example response

```json
{
  "planId": "PP-CX289-20261016",
  "scenario": "preventive",
  "recommendation": {
    "optionId": "R-289-01",
    "optimizationStatus": "BEST_FEASIBLE_FOUND",
    "reason": "Lowest modeled expected loss among feasible options while protecting the delivery commitment."
  },
  "options": [
    {
      "optionId": "R-289-01",
      "optionType": "reroute",
      "alternative": "SIN → DOH → FRA",
      "alternativeFlight": "CX660 + partner connection",
      "feasibilityStatus": "Feasible",
      "feasibilityPercentage": 97,
      "usableCapacityKg": 1200,
      "capacityStatus": "Confirmed",
      "expectedArrival": "2026-10-17T08:00:00Z",
      "expectedDelayHours": 3,
      "recoveryHandlingCost": 610,
      "totalModeledExpectedLoss": 4510,
      "currency": "HKD",
      "isRecommended": true,
      "recommendationReason": "Protects the service window with confirmed capacity and moderate handling cost.",
      "networkImpact": "Confirmed capacity; no displaced cargo identified."
    },
    {
      "optionId": "R-289-02",
      "optionType": "wait_for_next_flight",
      "alternative": "Later SIN → FRA departure",
      "alternativeFlight": "CX291 later departure",
      "feasibilityStatus": "Feasible",
      "feasibilityPercentage": 100,
      "usableCapacityKg": 1400,
      "capacityStatus": "Confirmed",
      "expectedArrival": "2026-10-17T15:00:00Z",
      "expectedDelayHours": 10,
      "recoveryHandlingCost": 220,
      "totalModeledExpectedLoss": 6920,
      "currency": "HKD",
      "isRecommended": false,
      "recommendationReason": "Lower handling cost, but higher delay impact.",
      "networkImpact": "No downstream displacement identified."
    }
  ],
  "optimization": {
    "status": "BEST_FEASIBLE_FOUND",
    "totalModeledExpectedLoss": 4510,
    "feasibilityPercentage": 97,
    "capacityStatus": "Sufficient",
    "downstreamShortfallKg": 0,
    "optimalityGap": null,
    "solverProofAvailable": false
  }
}
```

## 4. View Detailed Evaluation for One Option

`GET /api/v1/prevention-plans/{flightId}/options/{optionId}`

Returns the detailed evaluation used to explain the recommendation.

### Example response

```json
{
  "optionId": "R-289-01",
  "flightId": "CX289",
  "feasibility": {
    "status": "Feasible",
    "percentage": 97,
    "deliveryCommitmentFeasible": true,
    "reasons": [
      "Usable capacity covers the affected shipment weight.",
      "Alternative capacity is confirmed.",
      "Expected arrival is within the delivery commitment."
    ],
    "rejectedReasons": []
  },
  "capacity": {
    "usableCapacityKg": 1200,
    "shipmentWeightKg": 980,
    "capacityStatus": "Confirmed",
    "downstreamShortfallKg": 0,
    "alternativeFlightCapacityConsumedKg": 980
  },
  "arrival": {
    "expectedArrival": "2026-10-17T08:00:00Z",
    "expectedDelayHours": 3,
    "deliveryCommitmentFeasible": true
  },
  "costBreakdown": {
    "cargoAndCustomerImpact": 2450,
    "cathayContributionImpact": 2400,
    "recoveryAndHandlingCost": 610,
    "delayAndServiceImpact": 1050,
    "networkImpact": 0,
    "totalModeledExpectedLoss": 6510,
    "currency": "HKD"
  },
  "networkDominoEffect": {
    "alternativeFlight": "CX660 + partner connection",
    "alternativeFlightCapacityConsumedKg": 980,
    "additionalAffectedShipmentIds": [],
    "additionalAffectedShipmentCount": 0,
    "networkShortfallKg": 0
  },
  "recommendation": {
    "isRecommended": true,
    "optimizationStatus": "BEST_FEASIBLE_FOUND",
    "reasons": [
      "Best feasible option in the current candidate set.",
      "Confirmed capacity is available.",
      "Expected arrival protects the delivery commitment.",
      "No additional downstream shipments are affected."
    ]
  },
  "metadata": {
    "recommendationVersion": "recovery-heuristic-v3",
    "predictionTimestamp": "2026-10-16T09:10:00Z",
    "optimizationTimestamp": "2026-10-16T09:12:00Z",
    "optimalityGap": null,
    "simulated": true
  }
}
```

`totalModeledExpectedLoss` should equal:

```text
cargoAndCustomerImpact
+ cathayContributionImpact
+ recoveryAndHandlingCost
+ delayAndServiceImpact
+ networkImpact
```

The values above are illustrative. Production values should always be calculated by the optimization service.

## 5. Submit Human Review Decision

`POST /api/v1/prevention-plans/{flightId}/decisions`

Records an operational review decision for a preventive option.

### Request fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `optionId` | string | Yes | Option being reviewed |
| `decision` | enum | Yes | `approved-for-review` or `rejected-override` |
| `reason` | string | Yes | Human-entered decision reason |
| `reviewerId` | string | Yes | User or operator identifier |
| `reviewedAt` | string | Yes | ISO-8601 datetime |

### Example request

```json
{
  "optionId": "R-289-01",
  "decision": "approved-for-review",
  "reason": "Confirmed capacity protects the shipment deadline and has no modeled downstream displacement.",
  "reviewerId": "ops-user-104",
  "reviewedAt": "2026-10-16T09:20:00Z"
}
```

### Example response

```json
{
  "decisionId": "DEC-20261016-00042",
  "planId": "PP-CX289-20261016",
  "flightId": "CX289",
  "optionId": "R-289-01",
  "decision": "approved-for-review",
  "reason": "Confirmed capacity protects the shipment deadline and has no modeled downstream displacement.",
  "recordedAt": "2026-10-16T09:20:04Z",
  "nextLifecycleState": "REVIEW_REQUIRED",
  "allocationMade": false,
  "simulated": true
}
```
