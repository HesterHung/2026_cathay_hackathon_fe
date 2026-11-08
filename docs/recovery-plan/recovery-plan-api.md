# Recovery Plan API

This contract defines the flight-level recovery workflow. It covers operator review after an offload is confirmed.

## Conventions

- Monetary values are numeric amounts in HKD. Responses include `currency: "HKD"` wherever monetary values are returned.
- Weights use numeric kilograms with fields ending in `Kg`.
- Volumes use numeric cubic meters with fields ending in `M3`.
- Delays use numeric minutes with fields ending in `Minutes`.
- Probabilities are decimals from `0` to `1`.
- Feasibility percentages are numeric values from `0` to `100`.
- Timestamps use ISO-8601 UTC strings.
- A recovery review decision must not itself book a route, reserve capacity, or reassign cargo.
- `bestOptions` identifies the feasible options with the lowest `totalModeledExpectedLoss`; this comparison is not a solver optimality proof.
- Recovery decisions are recorded for confirmed offloads. They do not themselves execute a booking or cargo reassignment.

## 1. List Recovery Cases

`GET /api/v1/recovery-plans?page=1&limit=20`

Lists confirmed offload cases that need operator review and recovery planning.

The response totals summarize the queue: `totalCases` counts recovery cases, while `totalAffectedShipments` counts unique affected shipments across those cases.

`workflowStage` is intentionally not returned because `/recovery-plans` already scopes this response to the recovery workflow; the backend may retain it internally for lifecycle management.

### Request query parameters

| Parameter | Type | Default | Validation | Note |
|---|---|---:|---|---|
| `page` | integer | `1` | Must be `>= 1` | One-based page number |
| `limit` | integer | `20` | Must be between `1` and `100` | Cases returned per page; request-only and not echoed in the response |

### Response item fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `flightId` | string | Flight number | |
| `status` | enum | `RECOVERY_REQUIRED`, `REVIEWED` | Recovery cases exist only after an offload is confirmed |
| `affectedShipmentCount` | integer | Count | |
| `estimatedShipmentValue` | number | Currency amount | |
| `currency` | string | ISO currency code | |

### Response envelope fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `items` | object[] | Array of recovery review items | Each item follows the response item fields table above |
| `totalCases` | integer | Count | Total recovery cases across all pages |
| `totalAffectedShipments` | integer | Unique count | Total unique affected shipments across all pages |
| `pagination` | object | Pagination metadata | Described in the pagination fields table below |

### Pagination fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `page` | integer | One-based page number | Current page returned |
| `totalPages` | integer | Count | Total number of available pages |
| `hasNextPage` | boolean | `true` or `false` | Whether another page is available |

### Example response

```json
{
  "items": [
    {
      "flightId": "CX289",
      "status": "RECOVERY_REQUIRED",
      "affectedShipmentCount": 1,
      "estimatedShipmentValue": 4968,
      "currency": "HKD"
    },
    {
      "flightId": "CX880",
      "status": "REVIEWED",
      "affectedShipmentCount": 1,
      "estimatedShipmentValue": 616,
      "currency": "HKD"
    }
  ],
  "totalCases": 2,
  "totalAffectedShipments": 2,
  "pagination": {
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

## 2. View an Offloaded Flight and Affected Shipments

`GET /api/v1/recovery-plans/{flightId}`

Returns the offloaded flight, confirmed offload context, affected shipment details, and recovery review context.

### Response fields

| Field | Type | Description |
|---|---|---|
| `recoveryPlanId` | string | Identifies this recovery plan |
| `currency` | string | Currency for monetary values; `HKD` |
| `flight` | object | Offloaded flight details; see Flight fields |
| `review` | object | Confirmed offload details; see Review fields |
| `capacity` | object | Payload and booking metrics; see Capacity fields |
| `affectedShipments` | object[] | Affected shipment details; see Affected shipment fields |

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
| `status` | enum | `RECOVERY_REQUIRED`, `REVIEWED` | Current recovery case status; the confirmed offload is recorded in `offloadConfirmedAt` |
| `offloadReason` | string | Text | Recorded reason for the confirmed offload |
| `offloadConfirmedAt` | string | ISO-8601 datetime | Time the offload was confirmed |

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
| `estimatedShipmentValue` | number | Currency amount | Estimated value of the affected shipment; use the response currency |

### Example response

```json
{
  "recoveryPlanId": "RP-CX289-20261016",
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
    "status": "RECOVERY_REQUIRED",
    "offloadReason": "Ramp weather and updated fuel requirement",
    "offloadConfirmedAt": "2026-10-16T09:10:00Z"
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
      "estimatedShipmentValue": 4968
    }
  ]
}
```

## 3. Get Recovery Options

`GET /api/v1/recovery-plans/{flightId}/options`

Generates and compares recovery alternatives for the selected flight.

### Response fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `bestOptions` | string[] | Option IDs | IDs with the lowest modeled expected loss among feasible options; can contain multiple tied options |
| `options` | object[] | Recovery option records | Each item follows the option fields table below |

### Option fields

| Field | Type | Description |
|---|---|---|
| `optionId` | string | Unique within the selected recovery review |
| `optionType` | enum | `rebook`, `reroute`, `wait_for_next_flight`, `split` |
| `recoveryLegs` | object[] | Ordered route legs; see recoveryLegs fields below |
| `feasibilityStatus` | enum | `Feasible`, `Infeasible`, `Feasibility Unknown` |
| `feasibilityPercentage` | number | Estimated feasibility from `0` to `100` |
| `usableCapacityKg` | number | Capacity available for the affected shipment |
| `capacityStatus` | enum | `Confirmed`, `Nominal / Weather Constrained`, `Capacity Confirmation Pending` |
| `fuelStatus` | enum | `Fuel OK`, `Fuel Pending`, `Buffer Reduced`, `Fuel Review Needed` |
| `fuelConstraint` | string | Fuel or payload constraint details |
| `weatherExposure` | enum | `Clear`, `Weather Exposure`, `Weather Constrained`, `Weather Confirmation Pending` |
| `expectedArrival` | string | Expected arrival time in ISO-8601 UTC format |
| `expectedDelayMinutes` | number | Delay relative to the original plan, in minutes |
| `recoveryHandlingCost` | number | Direct recovery and handling cost in `currency` |
| `totalModeledExpectedLoss` | number | Combined modeled business impact in `currency` |
| `missingData` | string[] | Missing confirmations; a non-empty list displays as `Check data` |
| `currency` | string | ISO currency code; `HKD` |
| `networkImpact` | string | Summary of downstream network effects |

#### Comparison table mapping

| Column | API fields |
|---|---|
| **Option** | `optionId` |
| **Route** | Ordered `recoveryLegs` |
| **Capacity** | `usableCapacityKg`, `capacityStatus` |
| **Fuel / WX** | `fuelStatus`, `fuelConstraint`, `weatherExposure` |
| **Arrival** | `expectedArrival`, `expectedDelayMinutes` |
| **Costs** | `recoveryHandlingCost`; detailed breakdown is in section 4 |
| **Total Loss** | `totalModeledExpectedLoss` |
| **Status** | `bestOptions`, `missingData`, `feasibilityStatus` |

`fuelStatus` is determined from the fuel constraint: use `Fuel OK` when no additional constraint is identified, `Fuel Pending` when confirmation is outstanding, `Buffer Reduced` when a fuel requirement reduces payload, and `Fuel Review Needed` when the fuel plan needs review.

Derive the comparison status without a separate status field: show `Best` when the option ID is in `bestOptions`, `Check data` when `missingData` is non-empty, `Suggested` when `feasibilityStatus` is `Feasible`, and `Not feasible` otherwise.

Use `Clear` when no material weather exposure is identified, `Weather Exposure` when weather may affect the route or handling, `Weather Constrained` when weather limits capacity or operations, and `Weather Confirmation Pending` when conditions or their operational impact still need confirmation.

### `recoveryLegs` fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `from` | string | IATA airport code | Leg departure airport |
| `to` | string | IATA airport code | Leg arrival airport |
| `operatingFlightId` | string | Flight or movement identifier | Actual movement used for this leg |

Every option must return `recoveryLegs` as an array of leg objects, including direct itineraries (one leg). Each leg must include all three fields above; do not return a route as a single display string.

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
      "fuelStatus": "Fuel OK",
      "fuelConstraint": "No additional fuel constraint identified",
      "weatherExposure": "Weather Exposure",
      "expectedArrival": "2026-10-17T08:00:00Z",
      "expectedDelayMinutes": 180,
      "recoveryHandlingCost": 4760,
      "totalModeledExpectedLoss": 50780,
      "missingData": [],
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
      "fuelStatus": "Fuel OK",
      "fuelConstraint": "Later departure fuel plan confirmed",
      "weatherExposure": "Weather Exposure",
      "expectedArrival": "2026-10-17T15:00:00Z",
      "expectedDelayMinutes": 600,
      "recoveryHandlingCost": 1720,
      "totalModeledExpectedLoss": 53980,
      "missingData": [],
      "currency": "HKD",
      "networkImpact": "No downstream displacement identified."
    }
  ]
}
```

## 4. View Detailed Evaluation for One Option

`GET /api/v1/recovery-plans/{flightId}/options/{optionId}`

Returns the detailed evaluation used to explain the recommendation.

Only fields rendered by the human-review drawer are returned here. The `capacity` object is limited to the option values shown in that drawer.

### Response fields

| Field | Type | Unit / format | Note |
|---|---|---|---|
| `optionId` | string | Option identifier | Identifies the evaluated option |
| `shipmentId` | string | Shipment identifier | Shipment the option protects |
| `isFeasible` | boolean | `true` or `false` | Whether the option is currently considered feasible |
| `feasibilityPercentage` | number | `0` to `100` | Estimated feasibility percentage |
| `capacityStatus` | enum | `Confirmed`, `Nominal / Weather Constrained`, `Capacity Confirmation Pending` | Confidence in the capacity value |
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
| `cargoCustomerImpact` | number | Currency amount | Modeled cargo and customer impact |
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
    "cargoCustomerImpact": 19110,
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
cargoCustomerImpact
+ cathayContributionImpact
+ recoveryAndHandlingCost
+ delayAndServiceImpact
+ downstreamNetworkImpact
```

Validate the equality when producing detailed evaluations, using numeric amounts in HKD and a tolerance of at most HKD 0.01 for decimal rounding. The `costBreakdown.currency` must equal the response-level `currency`. Scenario sensitivity totals must use the same component definition and currency.

The values above are illustrative. Production values should always be calculated by the optimization service.

## 5. Submit Human Review Decision

`POST /api/v1/recovery-plans/{flightId}/decisions`

Records an operational review decision for a recovery option.

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
Location: /api/v1/recovery-plans/CX289/decisions/DEC-20261016-00042
```

The response body is empty (no JSON envelope). The `201` status confirms that the decision record was created. A `Location` header may identify the new decision record. Validation or persistence failures should return an appropriate `4xx` or `5xx` error response.
