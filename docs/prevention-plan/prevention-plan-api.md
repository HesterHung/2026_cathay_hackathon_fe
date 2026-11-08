# Prevention Plan API

This contract defines the flight-level prevention workflow. It covers forecast-risk review before an offload is confirmed.

## Conventions

- Monetary values are numeric amounts with a separate `currency`, defaulting to `HKD`.
- Weights use numeric kilograms with fields ending in `Kg`.
- Volumes use numeric cubic meters with fields ending in `M3`.
- Delays use numeric minutes with fields ending in `Minutes`.
- Probabilities are decimals from `0` to `1`.
- Feasibility percentages are numeric values from `0` to `100`.
- Timestamps use ISO-8601 UTC strings.
- Preventive review must not create an allocation or confirm an offload.
- `bestOptions` identifies the feasible options with the lowest `totalModeledExpectedLoss`; this comparison is not a solver optimality proof.
- The current frontend uses camelCase fields, while the synthetic JSON uses snake_case such as `option_id` and `estimated_arrival`. An API adapter should normalize these before returning responses.

## 1. List Flights Requiring Preventive Review

`GET /api/v1/prevention-plans?page=1&limit=20`

Lists forecast-risk flights that need operator review before an offload is confirmed.

The response totals summarize the queue: `totalCases` counts flights requiring review, while `totalShipmentsAtRisk` counts unique affected shipments across those flights.

`workflowStage` is intentionally not returned because `/prevention-plans` already scopes this response to the prevention workflow; the backend may retain it internally for lifecycle management.

### Request query parameters

| Parameter | Type | Default | Validation | Note |
|---|---|---:|---|---|
| `page` | integer | `1` | Must be `>= 1` | One-based page number |
| `limit` | integer | `20` | Must be between `1` and `100` | Cases returned per page; request-only and not echoed in the response |

### Response item fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `flightId` | string | Flight number | |
| `status` | enum | `AT_RISK`, `PREVENTIVE_ACTION_REQUIRED`, `REVIEWED` | |
| `riskLevel` | enum | `Low`, `Moderate`, `High`, `Critical` | |
| `riskTypes` | enum[] | `CAPACITY_SHORTFALL`, `WEATHER`, `GROUND_HANDLING_DELAY`, `FLIGHT_DELAY`, `MISSED_CONNECTION`, `OFFLOAD_CONFIRMED` | One flight can have multiple risk types |
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
      "riskTypes": ["WEATHER", "GROUND_HANDLING_DELAY"],
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
      "riskTypes": ["WEATHER", "MISSED_CONNECTION"],
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

`GET /api/v1/prevention-plans/{flightId}/options`

Generates and compares preventive alternatives for the selected flight.

### Response fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `bestOptions` | string[] | Option IDs | IDs with the lowest modeled expected loss among feasible options; can contain multiple tied options |
| `options` | object[] | Preventive option records | Each item follows the option fields table below |

### Option fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `optionId` | string | Unique option identifier | Unique within the selected prevention review |
| `optionType` | enum | `rebook`, `reroute`, `wait_for_next_flight`, `split` | Action proposed for the shipment |
| `recoveryLegs` | object[] | Structured route legs | Each leg contains `from`, `to`, and `operatingFlightId` |
| `feasibilityStatus` | enum | `Feasible`, `Infeasible`, `Pending` | Whether the option can currently be used |
| `feasibilityPercentage` | number | `0` to `100` | Estimated feasibility percentage |
| `usableCapacityKg` | number | Kilograms | Capacity available to protect the affected shipment |
| `capacityStatus` | enum | `Confirmed`, `Nominal / weather constrained`, `Capacity confirmation pending` | Confidence in the capacity value |
| `expectedArrival` | string | ISO-8601 datetime | Expected arrival time in UTC |
| `expectedDelayMinutes` | number | Minutes | Delay relative to the original plan |
| `recoveryHandlingCost` | number | Currency amount | Direct recovery and handling cost in `currency` |
| `totalModeledExpectedLoss` | number | Currency amount | Combined modeled business impact in `currency` |
| `currency` | string | ISO currency code | Defaults to `HKD` for monetary fields |
| `networkImpact` | string | Text | Summary of downstream network effects |

### `recoveryLegs` fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `from` | string | IATA airport code | Leg departure airport |
| `to` | string | IATA airport code | Leg arrival airport |
| `operatingFlightId` | string | Flight or movement identifier | Actual movement used for this leg |

### Example response

```json
{
  "bestOptions": ["R-289-01"],
  "options": [
    {
      "optionId": "R-289-01",
      "optionType": "reroute",
      "recoveryLegs": [
        { "from": "SIN", "to": "DOH", "operatingFlightId": "CX660" },
        { "from": "DOH", "to": "FRA", "operatingFlightId": "PARTNER-DOH-FRA" }
      ],
      "feasibilityStatus": "Feasible",
      "feasibilityPercentage": 97,
      "usableCapacityKg": 1200,
      "capacityStatus": "Confirmed",
      "expectedArrival": "2026-10-17T08:00:00Z",
      "expectedDelayMinutes": 180,
      "recoveryHandlingCost": 4760,
      "totalModeledExpectedLoss": 50780,
      "currency": "HKD",
      "networkImpact": "Confirmed capacity; no displaced cargo identified."
    },
    {
      "optionId": "R-289-02",
      "optionType": "wait_for_next_flight",
      "recoveryLegs": [
        { "from": "SIN", "to": "FRA", "operatingFlightId": "CX291" }
      ],
      "feasibilityStatus": "Feasible",
      "feasibilityPercentage": 100,
      "usableCapacityKg": 1400,
      "capacityStatus": "Confirmed",
      "expectedArrival": "2026-10-17T15:00:00Z",
      "expectedDelayMinutes": 600,
      "recoveryHandlingCost": 1720,
      "totalModeledExpectedLoss": 53980,
      "currency": "HKD",
      "networkImpact": "No downstream displacement identified."
    }
  ]
}
```

## 4. View Detailed Evaluation for One Option

`GET /api/v1/prevention-plans/{flightId}/options/{optionId}`

Returns the detailed evaluation used to explain the recommendation.

Only fields rendered by the human-review drawer are returned here. The `capacity` object is limited to the option values shown in that drawer.

### Response fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `optionId` | string | Option identifier | Identifies the evaluated option |
| `shipmentId` | string | Shipment identifier | Shipment the option protects |
| `isFeasible` | boolean | `true` or `false` | Whether the option is currently considered feasible |
| `feasibilityPercentage` | number | `0` to `100` | Estimated feasibility percentage |
| `capacityStatus` | enum | `Confirmed`, `Nominal / weather constrained`, `Capacity confirmation pending` | Confidence in the capacity value |
| `networkShortfallKg` | number | Kilograms | Forecast network capacity shortfall associated with this option |
| `currency` | string | ISO currency code | Currency used by monetary fields; defaults to `HKD` |
| `capacity` | object | Capacity details | Described in the capacity fields table below |
| `costBreakdown` | object | Currency amounts | Described in the cost breakdown fields table below |
| `explanation` | string[] | Text list | Human-readable factors supporting the evaluation |
| `networkDominoEffect` | object | Network impact details | Described in the network domino effect fields table below |
| `scenarioSensitivity` | object[] | Scenario comparison | Described in the scenario sensitivity fields table below |

### Capacity fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `usableCapacityKg` | number | Kilograms | Capacity available to protect the affected shipment |

### Cost breakdown fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `cargoAndCustomerImpact` | number | Currency amount | Modeled cargo and customer impact |
| `cathayContributionImpact` | number | Currency amount | Modeled impact to Cathay contribution |
| `recoveryAndHandlingCost` | number | Currency amount | Direct recovery and handling cost |
| `delayAndServiceImpact` | number | Currency amount | Modeled cost of delay and service impact |
| `downstreamNetworkImpact` | number | Currency amount | Modeled impact to downstream network operations |
| `totalModeledExpectedLoss` | number | Currency amount | Sum of the five cost components; uses the response `currency` |
| `currency` | string | ISO currency code | Currency for all amounts in this object |

### Network domino effect fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `additionalAffectedShipmentIds` | string[] | Shipment identifiers | Additional shipments affected beyond the shipment under review |
| `additionalAffectedShipmentCount` | integer | Count | Number of additional affected shipments |
| `networkShortfallKg` | number | Kilograms | Capacity shortfall caused or exposed across the downstream network |

### Scenario sensitivity fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `label` | string | Text | Scenario assumption or input change being evaluated |
| `totalModeledExpectedLoss` | number | Currency amount | Modeled expected loss under the scenario, in the response `currency` |

### Example response

```json
{
  "optionId": "R-289-01",
  "shipmentId": "CX-483117",
  "isFeasible": true,
  "feasibilityPercentage": 97,
  "capacityStatus": "Confirmed",
  "networkShortfallKg": 0,
  "currency": "HKD",
  "capacity": {
    "usableCapacityKg": 1200
  },
  "costBreakdown": {
    "cargoAndCustomerImpact": 19110,
    "cathayContributionImpact": 18720,
    "recoveryAndHandlingCost": 4760,
    "delayAndServiceImpact": 8190,
    "downstreamNetworkImpact": 0,
    "totalModeledExpectedLoss": 50780,
    "currency": "HKD"
  },
  "explanation": [
    "R-289-01 is the best feasible option in the current candidate set.",
    "It provides 1,200 kg usable capacity and is estimated at 97% feasible.",
    "The trade-off is HKD 4,760 recovery cost and 180 minutes of delay.",
    "No displaced cargo identified.",
    "Optimality has not been proved; a validated optimization solver and confirmed downstream capacity are still required."
  ],
  "networkDominoEffect": {
    "additionalAffectedShipmentIds": [],
    "additionalAffectedShipmentCount": 0,
    "networkShortfallKg": 0
  },
  "scenarioSensitivity": [
    { "label": "Current inputs", "totalModeledExpectedLoss": 50780 },
    { "label": "Fuel estimate +600 kg", "totalModeledExpectedLoss": 47600 },
    { "label": "Weather capacity -600 kg", "totalModeledExpectedLoss": 47600 },
    { "label": "Alternative unavailable", "totalModeledExpectedLoss": 45500 }
  ]
}
```

`totalModeledExpectedLoss` should equal:

```text
cargoAndCustomerImpact
+ cathayContributionImpact
+ recoveryAndHandlingCost
+ delayAndServiceImpact
+ downstreamNetworkImpact
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

### Success response

```http
201 Created
Location: /api/v1/prevention-plans/CX289/decisions/DEC-20261016-00042
```

The response body is empty. The `201` status confirms that the decision record was created, while the `Location` header identifies the new decision record. Validation or persistence failures should return an appropriate `4xx` or `5xx` error response.
