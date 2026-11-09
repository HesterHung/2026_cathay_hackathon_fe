# Recovery Solution API

This contract defines one shared, ULD-level resource for the three operational work queues:

1. **Disruption** — an offload is confirmed.
2. **Predicted offload** — a ULD is forecast to be offloaded, but no offload is confirmed.
3. **Pending pool** — a domino-offload ULD is available for lower-priority review or possible no-show replacement.

The ULD is the prediction, capacity, and routing-solution unit. The frontend groups ULD records under their **Master Air Waybill (MAWB)** so operators can work from the airway bill view. The persisted recovery-solution record is linked to both the ULD and its MAWB document; a MAWB is a display/document grouping, not the prediction unit.

## Conventions and lifecycle rules

| Topic | Contract rule |
|---|---|
| Collection | `/api/v1/recovery-solutions` is the shared collection. Use `type` to filter; omit it to return all queues. |
| Queue types | `DISRUPTION`, `PREDICTED_OFFLOAD`, or `PENDING_POOL`. |
| Disruption confirmation | A forecast or review never confirms an offload. Confirmation requires an authoritative operational event or authorized decision. |
| Prediction review | A predicted ULD may have routing options and saved review without changing type or confirming an offload. |
| Pool decisions | `HOLD_FOR_PRIORITY`, `CONSIDER_FOR_NO_SHOW`, `RELEASE_HOLD`, and `CLEAR_NO_SHOW_REVIEW` record review dispositions only; they do not assign a ULD or reserve capacity. |
| Route review | `APPROVE_FOR_REVIEW` records a reviewed route candidate; it does not book a route or confirm a predicted offload. |
| Operational execution | Executing a route, assigning/substituting a ULD, and reserving capacity require a separate authorized allocation API. This contract supports evidence review and decision recording only. |
| Route ranking | Rank feasible options by `totalModeledExpectedLoss`; the ranking is not proof of global optimality. |
| Units | Weight is numeric kilograms (`Kg`); volume is numeric cubic meters (`M3`); delay is minutes; probabilities are decimals from `0` to `1`; timestamps are ISO-8601 UTC strings. |
| Currency | Monetary values are numeric amounts paired with an ISO currency code. Examples use `HKD`. |
| JSON naming | Field names use camelCase. Adapters normalize snake_case source data before returning API responses. |

## Queue priority and work gating

The three `type` values are mutually exclusive queue classifications for each ULD work item. Priority is evaluated across all active work items, not independently within a page:

1. `DISRUPTION` — priority 1; an offload has authoritative confirmation.
2. `PREDICTED_OFFLOAD` — priority 2; forecast risk exists, but no offload is confirmed.
3. `PENDING_POOL` — priority 3; domino-offload inventory that may be protected for priority demand or evaluated for a confirmed no-show.

The API is the source of truth for gating. Every list response includes `workflowControl`, even when filtered by `type`, so a filtered page cannot mistakenly conclude that it is the highest active priority. `activePriority` is the smallest priority number with active work; it is `null` if there is none. Items with terminal statuses do not block lower priorities. A work item is "finished" for queue gating only when it reaches a terminal status listed below; saving a review or reaching `REVIEWED` does not finish it.

| Queue | When it may be worked | While blocked |
|---|---|---|
| `DISRUPTION` | Always. | Never blocked by a lower-priority queue. |
| `PREDICTED_OFFLOAD` | Only when there is no active `DISRUPTION`. | Keep the tab visible, but disable review/route-decision actions and explain the blocking disruption IDs. |
| `PENDING_POOL` | May be viewed at any time. `HOLD_FOR_PRIORITY` is allowed to protect inventory. A candidate may be evaluated for an active priority 1 or 2 target; `CONSIDER_FOR_NO_SHOW` is allowed only when linked to that target and a validated no-show event. General pool dispositions without a priority target are allowed only when no active disruption or prediction is being bypassed. | Keep inventory read-only except for the specified protection action and target-linked candidate evaluation. |

This policy does not hide lower-priority work items or prevent read-only inspection. It gates actions that would advance or consume lower-priority work. An operator may inspect pending-pool candidates while handling a disruption or predicted risk, then either continue with the target ULD's route options or evaluate a compatible pool candidate for that target. `HOLD_FOR_PRIORITY` protects inventory; it is not a capacity reservation. Candidate evaluation reports compatibility only. Neither path allocates or reserves capacity.

### Gate behavior by active priority

| `activePriority` | Disruption actions | Prediction actions | Pending-pool actions |
|---|---|---|---|
| `1` | Enabled for active disruption items. | Disabled; return `423 Locked` for decisions, with active disruption IDs. | Listing and detail reads enabled. `HOLD_FOR_PRIORITY` enabled. Candidate checks and `CONSIDER_FOR_NO_SHOW` allowed only when tied to an active priority 1 target and, for no-show, a validated event. Untargeted/general pool disposition is disabled. |
| `2` | No active disruption exists; any terminal disruption history is read-only. | Enabled for active predicted items. | Listing and detail reads enabled. `HOLD_FOR_PRIORITY` enabled. Candidate checks and `CONSIDER_FOR_NO_SHOW` allowed only when tied to an active priority 2 target and, for no-show, a validated event. Untargeted/general pool disposition is disabled. |
| `3` | No active disruption exists; any terminal disruption history is read-only. | No active predictions exist; any terminal prediction history is read-only. | Listing, candidate review, and general pool dispositions enabled, subject to type validation and confirmed no-show evidence. |
| `null` | No active work; historical items are read-only. | No active work; historical items are read-only. | Listing is enabled; there are no active work items to disposition. If an active pool item exists, `activePriority` is `3`. |

`allowedActionsByType` lists actions permitted in the current workflow state, but does not waive per-action requirements. In particular, the presence of `CONSIDER_FOR_NO_SHOW` means the client may offer it only after supplying an active target and validated no-show event. Candidate lookup is a read/evaluation operation; the decision write records the review and does not replace an allocation.

Examples of `workflowControl` returned with list responses:

```json
{
  "activePriority": 1,
  "canWorkDisruptions": true,
  "canWorkPredictions": false,
  "canReviewPool": false,
  "allowedActionsByType": {
    "DISRUPTION": ["APPROVE_FOR_REVIEW", "REJECT_OVERRIDE"],
    "PREDICTED_OFFLOAD": [],
    "PENDING_POOL": ["HOLD_FOR_PRIORITY", "CONSIDER_FOR_NO_SHOW"]
  },
  "blockingWorkItemIds": ["ULD-DISRUPTED-01"],
  "message": "Resolve active disruption work before prediction decisions or general pool dispositions. Pool candidate review must target an active priority 1 item."
}
```

Here `CONSIDER_FOR_NO_SHOW` is available only for a candidate tied to the active disruption and a validated no-show event. It is not a general pool action.

```json
{
  "activePriority": 2,
  "canWorkDisruptions": true,
  "canWorkPredictions": true,
  "canReviewPool": false,
  "allowedActionsByType": {
    "DISRUPTION": [],
    "PREDICTED_OFFLOAD": ["APPROVE_FOR_REVIEW", "REJECT_OVERRIDE"],
    "PENDING_POOL": ["HOLD_FOR_PRIORITY", "CONSIDER_FOR_NO_SHOW"]
  },
  "blockingWorkItemIds": [],
  "message": "Prediction decisions are enabled. General pool dispositions remain gated; candidate review must target an active priority 2 item."
}
```

```json
{
  "activePriority": 3,
  "canWorkDisruptions": true,
  "canWorkPredictions": true,
  "canReviewPool": true,
  "allowedActionsByType": {
    "DISRUPTION": [],
    "PREDICTED_OFFLOAD": [],
    "PENDING_POOL": ["HOLD_FOR_PRIORITY", "RELEASE_HOLD", "CONSIDER_FOR_NO_SHOW", "CLEAR_NO_SHOW_REVIEW"]
  },
  "blockingWorkItemIds": [],
  "message": null
}
```

In the priority 3 example, a no-show decision still requires a validated event and target under the decision contract. Empty action lists for types with no active work mean there are no actionable items of that type in the current result context.

### Endpoint index

| # | Method and path | Purpose | Changes operational state? |
|---|---|---|---|
| 1 | `GET /api/v1/recovery-solutions` | List and filter ULD work items for all three queues. | No |
| 2 | `GET /api/v1/recovery-solutions/{workItemId}` | Read one ULD work item, evidence, and review history. | No |
| 3 | `GET /api/v1/recovery-solutions/{workItemId}/options` | Read routing candidates for disruption or predicted-offload work. | No |
| 4 | `GET /api/v1/recovery-solutions/{workItemId}/options/{optionId}` | Read detailed evaluation for one route option. | No |
| 5 | `POST /api/v1/recovery-solutions/{workItemId}/offload-confirmations` | Record authoritative offload confirmation and move a forecast into disruption. | Yes; queue lifecycle transition |
| 6 | `GET /api/v1/recovery-solutions/{workItemId}/replacement-candidates` | Check a pool ULD against a priority target or confirmed no-show. | No; compatibility evaluation only |
| 7 | `POST /api/v1/recovery-solutions/{workItemId}/decisions` | Save a review decision or pool disposition. | Saves review only; no booking or allocation |

All reads may be filtered or gated according to `workflowControl`. Mutating requests must validate current priority, item type, authoritative evidence, and document version.

`workflowControl` contains:

| Field | Type | Description |
|---|---|---|
| `activePriority` | integer or null | `1`, `2`, `3`, or `null` according to active queues. |
| `canWorkDisruptions` | boolean | Always `true`. |
| `canWorkPredictions` | boolean | False while any active disruption remains. |
| `canReviewPool` | boolean | Whether general priority-3 dispositions may be made; protecting/evaluating inventory for a higher-priority target is reported separately in `allowedActionsByType`. |
| `allowedActionsByType` | object | Map of type to currently allowed decision names, after priority gating. Type-specific validation and required evidence still apply. |
| `blockingWorkItemIds` | string[] | Active higher-priority work items blocking this response's queue, if applicable. |
| `message` | string or null | User-facing reason when a queue action is gated. |

An action request that violates this policy returns `423 Locked` with a machine-readable `HIGHER_PRIORITY_WORK_OPEN` error and the blocking work-item IDs. Viewing queue items and evaluating pool candidates explicitly for a higher-priority target are not blocked.

Error responses use `{ "error": { "code": string, "message": string, "details": object } }`. `details` may include `blockingWorkItemIds`, current `documentVersion`, or field validation errors as applicable. Never return a success-shaped response when validation, an authoritative event lookup, or a MAWB document write fails.

## 1. List recovery-solution work items

`GET /api/v1/recovery-solutions?type=PREDICTED_OFFLOAD&page=1&limit=20`

### Query parameters

| Parameter | Type | Default | Validation / meaning |
|---|---|---|---|
| `type` | enum | All types | `DISRUPTION`, `PREDICTED_OFFLOAD`, or `PENDING_POOL` |
| `page` | integer | `1` | One-based; must be `>= 1` |
| `limit` | integer | `20` | Must be between `1` and `100` |
| `masterAirwayBillNumber` | string | None | Filter items linked to this MAWB |
| `flightId` | string | None | Filter items by source or affected flight |
| `status` | string | None | Filter by lifecycle or pool disposition status |
| `includeClosed` | boolean | `false` | Include terminal work items for history; terminal items never count as active priority work |

Examples of the three queue filters:

```http
GET /api/v1/recovery-solutions?type=DISRUPTION
GET /api/v1/recovery-solutions?type=PREDICTED_OFFLOAD
GET /api/v1/recovery-solutions?type=PENDING_POOL
```

### Common work-item fields

| Field | Type | Description |
|---|---|---|
| `workItemId` | string | Stable identifier for this ULD-level work item |
| `type` | enum | `DISRUPTION`, `PREDICTED_OFFLOAD`, or `PENDING_POOL` |
| `status` | string | Type-specific status described below |
| `predictionUnit` | enum | Always `ULD` |
| `uld` | object | The ULD-level prediction and solution subject |
| `masterAirwayBill` | object | Parent MAWB summary for frontend grouping and document linking |
| `flight` | object | Source/affected flight and route information |
| `cargo` | object | Cargo identifiers and summarized weight, volume, and handling properties |
| `document` | object | Persisted document identifier and version for the MAWB-linked solution record |
| `updatedAt` | string | ISO-8601 UTC timestamp |

`flight` contains `flightId`, `origin`, `destination`, `scheduledDeparture`, and `aircraftType` (nullable when unknown). For a pool item, `flightId` identifies the source flight; `pool.sourceFlightId` must match it.

`cargo` contains `shipmentIds`, `weightKg`, `volumeM3`, `handlingRequirements`, `commodity` (nullable when unavailable), and `valueAtRisk` plus `currency` (nullable when not calculated). Do not use declared cargo value as a substitute for modeled value at risk.

`document` contains `documentId`, `version`, and `updatedAt`. These are required for an editable work item; `documentId` must match `masterAirwayBill.documentId`. The document version is used for optimistic concurrency on decision writes.

### `uld` fields

| Field | Type | Description |
|---|---|---|
| `uldId` | string | ULD identifier; primary prediction-unit key |
| `uldType` | string | ULD equipment type/code |
| `weightKg` | number | Cargo weight associated with this ULD |
| `volumeM3` | number | Cargo volume associated with this ULD |
| `origin` | string | IATA origin code |
| `destination` | string | IATA destination code |

### `masterAirwayBill` fields

| Field | Type | Description |
|---|---|---|
| `number` | string | Master Air Waybill number (MAWB) |
| `documentId` | string | Identifier of the persisted MAWB document |
| `displayLabel` | string | Human-readable MAWB label shown in the frontend |

The frontend groups multiple ULD work items that share a MAWB under one MAWB row/card. Keep per-ULD status, prediction, option, and decision fields on each ULD item; do not merge them into a single MAWB-level prediction.

### Type-specific fields

| Type | Additional fields | Status values |
|---|---|---|
| `DISRUPTION` | `confirmedOffload` object with `confirmedAt`, `source` (`OPERATIONAL_EVENT` or `AUTHORIZED_DECISION`), `sourceEventId`, and `reason`; `caseSummary` object with `disruption`, `capacityConstraint`, `deliveryCommitment`, `baselineExpectedLoss`, and `currency`; optional `recoveryCaseId` | `RECOVERY_REQUIRED`, `REVIEWED`, `RECOVERY_IN_PROGRESS`, `RECOVERED`, `CLOSED` |
| `PREDICTED_OFFLOAD` | `forecast` object with `offloadProbability`, `capacityShortfallKg`, `confidence`, `forecastedAt`, `reasons`, `forecastCargoCapacityKg`, `bookedWeightKg`, and `valueAtRisk` plus `currency`; `caseSummary` object with `disruption`, `capacityConstraint`, `deliveryCommitment`, `baselineExpectedLoss`, and `currency`; no confirmation timestamp | `AT_RISK`, `PREVENTIVE_ACTION_REQUIRED`, `REVIEWED`, `CLEARED` |
| `PENDING_POOL` | `pool` object with `source` (`DOMINO_OFFLOAD`), `sourceFlightId`, `eligibleForNoShowReplacement`, `priorityHold`, and `disposition`; optional `lastDispositionAt` | `AVAILABLE`, `PRIORITY_HOLD`, `NO_SHOW_REVIEW`, `RETIRED` |

`forecast.confidence` is a percentage from `0` to `100`; `forecast.offloadProbability` is a probability from `0` to `1`. `forecast.valueAtRisk` is a modeled amount, paired with its `currency`.

`caseSummary` is present for disruption and predicted-offload items. `baselineExpectedLoss` is a modeled amount in the specified currency; `deliveryCommitment`, `capacityConstraint`, and `disruption` are display-ready summaries and do not replace detailed operational evidence.

For pool items, `pool.priorityHold` is a boolean and `pool.disposition` is `AVAILABLE`, `PRIORITY_HOLD`, or `NO_SHOW_REVIEW`. `eligibleForNoShowReplacement` is a general capability flag only; candidate-specific checks are required before considering replacement.

`CLEARED`, `RECOVERED`, `CLOSED`, and `RETIRED` are terminal for queue gating. A terminal item is omitted from the default list unless `includeClosed=true`.
All other statuses in the type-specific status table are active and count toward queue priority. In particular, `REVIEWED` remains active until the work item reaches a terminal state; a review alone does not clear a disruption or prediction. A disruption is finished for gating when it reaches `RECOVERED` or `CLOSED`; a prediction is finished when it reaches `CLEARED` or transitions to `DISRUPTION` after authoritative offload confirmation; a pool item is finished when it reaches `RETIRED`. `RECOVERY_IN_PROGRESS` remains active and continues to block lower-priority work.

### Flight-level predicted-offload display

Predictions and decisions remain ULD-level. To support the flight-level Predicted Offload screen, a predicted-offload list also returns a `flightSummaries` array. Each summary has `flightId`, `origin`, `destination`, `scheduledDeparture`, `aircraftType`, `offloadProbability`, `capacityShortfallKg`, `forecastCargoCapacityKg`, `bookedWeightKg`, `affectedUldCount`, `shipmentIds`, `valueAtRisk`, `currency`, `confidence`, `forecastedAt`, and `reasons`.

The summary values are produced by the forecasting service at flight level and must not be derived by summing ULD probabilities. Each `flightId` appears once; the associated ULD items remain separately available in `items`. The UI should display both the flight summary and its constituent ULDs, and identify the probability as a flight-level estimate.

### Response envelope

The response contains `items`, `totalItems`, `totalByType` (active counts for each type using the other filters, but independent of the `type` filter), `pagination` (`page`, `totalPages`, `hasNextPage`), and `workflowControl`. A predicted-offload response also contains `flightSummaries`; for other types it may be an empty array. Counts exclude terminal items unless `includeClosed=true`.

### Example request and response

```http
GET /api/v1/recovery-solutions?type=PREDICTED_OFFLOAD&masterAirwayBillNumber=123-45678901&page=1&limit=20
```

```json
{
  "items": [
    {
      "workItemId": "ULD-HKG-001",
      "type": "PREDICTED_OFFLOAD",
      "status": "PREVENTIVE_ACTION_REQUIRED",
      "predictionUnit": "ULD",
      "uld": {
        "uldId": "AKE12345CX",
        "uldType": "AKE",
        "weightKg": 980,
        "volumeM3": 5.8,
        "origin": "SIN",
        "destination": "FRA"
      },
      "masterAirwayBill": {
        "number": "123-45678901",
        "documentId": "MAWB-DOC-123-45678901",
        "displayLabel": "MAWB 123-45678901"
      },
      "flight": {
        "flightId": "CX289",
        "origin": "SIN",
        "destination": "FRA",
        "scheduledDeparture": "2026-10-16T21:15:00Z",
        "aircraftType": "A350"
      },
      "cargo": {
        "shipmentIds": ["CX-483117"],
        "weightKg": 980,
        "volumeM3": 5.8,
        "handlingRequirements": ["GENERAL_CARGO"],
        "commodity": "General cargo",
        "valueAtRisk": 19800,
        "currency": "HKD"
      },
      "caseSummary": {
        "disruption": "Ramp weather and updated fuel requirement",
        "capacityConstraint": "Forecast cargo capacity is 600 kg below booked weight",
        "deliveryCommitment": "Customer delivery commitment: 2026-10-19",
        "baselineExpectedLoss": 24500,
        "currency": "HKD"
      },
      "forecast": {
        "offloadProbability": 0.54,
        "capacityShortfallKg": 600,
        "confidence": 71,
        "forecastedAt": "2026-10-16T09:10:00Z",
        "reasons": ["Ramp weather and updated fuel requirement"],
        "forecastCargoCapacityKg": 12000,
        "bookedWeightKg": 12600,
        "valueAtRisk": 19800,
        "currency": "HKD"
      },
      "document": {
        "documentId": "MAWB-DOC-123-45678901",
        "version": 4,
        "updatedAt": "2026-10-16T09:10:00Z"
      },
      "updatedAt": "2026-10-16T09:10:00Z"
    }
  ],
  "totalItems": 1,
  "totalByType": {
    "DISRUPTION": 2,
    "PREDICTED_OFFLOAD": 1,
    "PENDING_POOL": 3
  },
  "workflowControl": {
    "activePriority": 1,
    "canWorkDisruptions": true,
    "canWorkPredictions": false,
    "canReviewPool": false,
    "allowedActionsByType": {
      "DISRUPTION": ["APPROVE_FOR_REVIEW", "REJECT_OVERRIDE"],
      "PREDICTED_OFFLOAD": [],
      "PENDING_POOL": ["HOLD_FOR_PRIORITY", "CONSIDER_FOR_NO_SHOW"]
    },
    "blockingWorkItemIds": ["ULD-HKG-DISRUPTED-01"],
    "message": "Resolve active disruption work before advancing predicted-offload or general pool work."
  },
  "flightSummaries": [
    {
      "flightId": "CX289",
      "origin": "SIN",
      "destination": "FRA",
      "scheduledDeparture": "2026-10-16T21:15:00Z",
      "aircraftType": "A350",
      "offloadProbability": 0.54,
      "capacityShortfallKg": 600,
      "forecastCargoCapacityKg": 12000,
      "bookedWeightKg": 12600,
      "affectedUldCount": 1,
      "shipmentIds": ["CX-483117"],
      "valueAtRisk": 19800,
      "currency": "HKD",
      "confidence": 71,
      "forecastedAt": "2026-10-16T09:10:00Z",
      "reasons": ["Ramp weather and updated fuel requirement"]
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

## 2. Get one ULD-level recovery-solution item

`GET /api/v1/recovery-solutions/{workItemId}`

Returns the common work-item fields, complete type-specific evidence, MAWB linkage, current saved solution/review history, case summary where applicable, and the document version. The path key identifies a ULD-level item, not a MAWB.

For `PREDICTED_OFFLOAD`, return forecast evidence and do not fabricate a confirmed-offload record. For `DISRUPTION`, return authoritative confirmation source, event ID, timestamp, and the case summary. For `PENDING_POOL`, return pool eligibility, current disposition, and any active target review/eligibility records. Include `workflowControl` so a client can render and gate actions consistently.

`reviewHistory` is an array of saved decisions, newest first. Each entry contains `decisionId`, `type`, `uldId`, `masterAirwayBillNumber`, `documentVersion`, `optionId` (nullable), `targetWorkItemId` (nullable), `confirmedNoShowEventId` (nullable), `decision`, `reason`, `reviewerId`, and `reviewedAt`. Do not infer a booking or allocation from a saved decision.

| Response section | Contents | Client use |
|---|---|---|
| Work item | Common fields plus evidence specific to its current `type`. | Render the ULD record and its queue status. |
| `workflowControl` | Active priority, allowed actions, blockers, and message. | Enable or disable page actions consistently across tabs. |
| `reviewHistory` | Saved reviews, newest first. | Show audit context; never treat a review as execution. |
| `document` | MAWB document ID and version. | Link the record to the MAWB and send version on writes. |

## 3. Get candidate routing solutions for a ULD

`GET /api/v1/recovery-solutions/{workItemId}/options`

Available for `DISRUPTION` and `PREDICTED_OFFLOAD` items. The same routing-option contract is used in both stages; the loss evaluation uses the case's current stage and evidence. `PENDING_POOL` items are pool inventory candidates and do not receive cargo recovery routes through this endpoint.

### Response fields

| Field | Type | Description |
|---|---|---|
| `workItemId` | string | ULD-level recovery-solution item |
| `type` | enum | `DISRUPTION` or `PREDICTED_OFFLOAD` |
| `bestOptions` | string[] | Feasible option IDs with the lowest `totalModeledExpectedLoss`; not an optimality proof |
| `options` | object[] | Candidate route solutions |
| `currency` | string | Currency for all monetary values |

### Option fields

| Field | Type | Description |
|---|---|---|
| `optionId` | string | Option identifier |
| `optionType` | enum | `rebook`, `reroute`, `wait_for_next_flight`, or `split` |
| `recoveryLegs` | object[] | Ordered route legs; each has `from`, `to`, and `operatingFlightId` |
| `feasibilityStatus` | enum | `Feasible`, `Infeasible`, or `Feasibility Unknown` |
| `feasibilityPercentage` | number | Estimated feasibility from `0` to `100` |
| `usableCapacityKg` | number | Capacity available for the ULD |
| `capacityStatus` | enum | `Confirmed`, `Nominal / Weather Constrained`, or `Capacity Confirmation Pending` |
| `fuelConstraint` | string | Fuel/payload constraint |
| `weatherExposure` | string | Weather exposure or confirmation requirement |
| `expectedArrival` | string | ISO-8601 UTC timestamp |
| `expectedDelayMinutes` | number | Delay from original plan |
| `recoveryHandlingCost` | number | Direct recovery and handling cost |
| `totalModeledExpectedLoss` | number | Combined modeled loss for this option |
| `costBreakdown` | object | Cargo/customer, carrier contribution, handling, delay/service, and downstream network impact |
| `missingData` | string[] | Constraints or confirmations still outstanding |
| `networkImpact` | string | Summary of downstream capacity effects |

Every `recoveryLegs` value is an array, including direct routes (one leg). Preserve unresolved capacity, connection, fuel, weather, and handling evidence in `missingData`; do not turn unconfirmed data into a feasible/confirmed claim.

| Result | Meaning |
|---|---|
| `bestOptions` | Feasible option IDs ranked by the lowest modeled expected loss; not proof of global optimality. |
| `options` | Candidate paths and their feasibility, capacity, cost, delay, and missing-data evidence. |
| No options endpoint for pool ULDs | Pool ULDs are evaluated against a target using endpoint 6; they do not get cargo-recovery routes here. |

## 4. Get detailed evaluation for one option

`GET /api/v1/recovery-solutions/{workItemId}/options/{optionId}`

Returns the option, ULD and MAWB references, feasibility evidence, explanation, `costBreakdown`, `networkDominoEffect`, and `scenarioSensitivity`.

The `costBreakdown` fields are `cargoCustomerImpact`, `cathayContributionImpact`, `recoveryAndHandlingCost`, `delayAndServiceImpact`, `downstreamNetworkImpact`, `totalModeledExpectedLoss`, and `currency`. The total is the sum of the five impact/cost components. Scenario sensitivity uses the same component definition and currency.

The response shapes are:

- `networkDominoEffect`: `{ affectedFlights: string[], affectedUldIds: string[], affectedShipmentIds: string[], additionalCapacityShortfallKg: number, summary: string }`.
- `scenarioSensitivity`: `{ inputChange: string, feasibilityStatus: string, costBreakdown: <costBreakdown> }[]`.
- `explanation`: `{ summary: string, reasons: string[], assumptions: string[], missingData: string[] }`.

When a value cannot be evaluated, return `null` where the field is nullable or explain the missing evidence in `missingData`; do not present unknown feasibility as feasible.

| Response object | Required content | Interpretation |
|---|---|---|
| `option` and references | Selected option plus ULD and MAWB identifiers. | Identifies the cargo and route being evaluated. |
| `costBreakdown` | Five impact/cost components, total, and currency. | Modeled estimate; total is the sum of the five components. |
| `networkDominoEffect` | Affected flights, ULDs, shipments, added shortfall, and summary. | Downstream network exposure; unknown evidence remains explicit. |
| `scenarioSensitivity` | Input change, feasibility status, and comparable cost breakdown. | Shows how assumptions change the modeled result. |
| `explanation` | Summary, reasons, assumptions, and missing data. | User-facing rationale and limitations. |

## 5. Confirm an offload from an authoritative event

`POST /api/v1/recovery-solutions/{workItemId}/offload-confirmations`

This endpoint is called only by an authorized operational integration or user decision flow. It transitions an unconfirmed `PREDICTED_OFFLOAD` ULD into the `DISRUPTION` queue. A forecast, a reviewed route option, or an API client assertion without an authoritative event is not confirmation. The transition is atomic, preserves forecast and review history, records the confirmation evidence, and updates the item type/status to `DISRUPTION` / `RECOVERY_REQUIRED`. It must not create a second active work item for the same ULD.

Request: `source` (`OPERATIONAL_EVENT` or `AUTHORIZED_DECISION`), unique `sourceEventId`, `confirmedAt`, `reason`, `reviewerId` (required for `AUTHORIZED_DECISION`), and `documentVersion`.

Return `200 OK` with the updated work item. Repeating the same `sourceEventId` is idempotent and returns the existing result. A conflicting/stale document version returns `409 Conflict`; an unauthorized source or invalid transition returns `422 Unprocessable Entity`.

When forecast evidence is withdrawn without a confirmed offload, an authorized lifecycle update changes the predicted item to terminal status `CLEARED`; it must not be converted into a disruption.

| Request field | Type | Rule |
|---|---|---|
| `source` | enum | `OPERATIONAL_EVENT` or `AUTHORIZED_DECISION`. |
| `sourceEventId` | string | Required unique authoritative event identifier; same-event retries are idempotent. |
| `confirmedAt` | timestamp | Required ISO-8601 UTC confirmation time. |
| `reason` | string | Required explanation for the confirmation. |
| `reviewerId` | string | Required when `source` is `AUTHORIZED_DECISION`. |
| `documentVersion` | integer | Required version for optimistic concurrency. |

| Outcome | Response |
|---|---|
| Confirmation accepted | `200 OK`; updated work item is now `DISRUPTION` / `RECOVERY_REQUIRED`. |
| Same event retried | `200 OK`; return the previously created transition. |
| Stale document | `409 Conflict`. |
| Unauthorized source or invalid transition | `422 Unprocessable Entity`. |

## 6. Find and evaluate pending-pool candidates for a no-show or priority target

`GET /api/v1/recovery-solutions/{workItemId}/replacement-candidates?targetWorkItemId={targetWorkItemId}&purpose=PRIORITY_ALTERNATIVE`

For a no-show replacement use `purpose=NO_SHOW_REPLACEMENT&confirmedNoShowEventId={eventId}`. `targetWorkItemId` and `purpose` are required; the event ID is required for `NO_SHOW_REPLACEMENT`.

The path item must be a `PENDING_POOL` ULD. The target must be an active `DISRUPTION` or `PREDICTED_OFFLOAD` ULD. The response returns candidate compatibility and evidence, not an assignment. A candidate is eligible only when its route, destination, handling requirements, available weight/volume, and applicable operational constraints are supported by current data. Unknown inputs produce `UNKNOWN` eligibility with explicit `missingData`; they must never be treated as eligible.

Each result contains `candidateWorkItemId`, `targetWorkItemId`, `eligibility` (`ELIGIBLE`, `INELIGIBLE`, `UNKNOWN`), `reasons`, `missingData`, `routeCompatible`, `handlingCompatible`, `weightCapacityAvailableKg`, `volumeCapacityAvailableM3`, and `requiresConfirmedNoShow`. `eligibility` describes compatibility only, not assignment or reserved capacity.

For `purpose=NO_SHOW_REPLACEMENT`, `confirmedNoShowEventId` is required before the candidate can be considered eligible for that use. The server resolves and validates the event's source, flight, original booked `uldId`, and confirmation time against the authoritative operational event source. The event must refer to the target flight. `eligibleForNoShowReplacement` is only a general capability flag; it is not proof that a particular no-show occurred or that a candidate is operationally compatible. Without a validated no-show event, do not return a no-show replacement result.

No endpoint in this contract books, assigns, or reserves a pool ULD. Actual substitution requires a separate authorized operational allocation API and confirmation; until then the candidate remains in `PENDING_POOL`.

| Input | Required when | Meaning |
|---|---|---|
| `targetWorkItemId` | Always | Active priority 1 or 2 ULD being considered for backup capacity. |
| `purpose=PRIORITY_ALTERNATIVE` | Checking an alternative for active priority work | Evaluates candidate compatibility with the target; no no-show is implied. |
| `purpose=NO_SHOW_REPLACEMENT` | Considering a no-show replacement | Requires `confirmedNoShowEventId` validated against the target flight and original booked ULD. |

| Candidate result | Meaning |
|---|---|
| `ELIGIBLE` | Required compatibility evidence is present and checks pass; still not an allocation. |
| `INELIGIBLE` | One or more known constraints fail. |
| `UNKNOWN` | Required data is missing; inspect `missingData` and do not treat as eligible. |

## 7. Record a recovery-solution decision or pool disposition

`POST /api/v1/recovery-solutions/{workItemId}/decisions`

The server validates the action against the item's `type`. It persists the decision as a versioned recovery-solution record attached to the MAWB document and associated ULD. The MAWB frontend view renders the saved decision under the corresponding ULD. The write must identify the ULD even when initiated from the MAWB view.

### Request fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `type` | enum | Yes | Must match the item's current type |
| `uldId` | string | Yes | ULD being reviewed; must match the path item |
| `masterAirwayBillNumber` | string | Yes | MAWB document to which the review is saved |
| `documentVersion` | integer | Yes | Version read by the client; use for optimistic concurrency |
| `optionId` | string or null | Conditional | Required for `APPROVE_FOR_REVIEW`; null for pool dispositions and reject/override |
| `targetWorkItemId` | string or null | Conditional | Required for `CONSIDER_FOR_NO_SHOW` when reviewing a candidate for a particular target; must identify an active priority 1 or 2 item |
| `confirmedNoShowEventId` | string or null | Conditional | Required for `CONSIDER_FOR_NO_SHOW`; must reference validated authoritative evidence for the target flight |
| `decision` | enum | Yes | `APPROVE_FOR_REVIEW`, `REJECT_OVERRIDE`, `HOLD_FOR_PRIORITY`, `RELEASE_HOLD`, `CONSIDER_FOR_NO_SHOW`, or `CLEAR_NO_SHOW_REVIEW` |
| `reason` | string | Yes | Operator rationale |
| `reviewerId` | string | Yes | User/operator identifier |
| `reviewedAt` | string | Yes | ISO-8601 UTC timestamp |

Allowed decisions by type:

| Type | Allowed decisions |
|---|---|
| `DISRUPTION` | `APPROVE_FOR_REVIEW`, `REJECT_OVERRIDE` |
| `PREDICTED_OFFLOAD` | `APPROVE_FOR_REVIEW`, `REJECT_OVERRIDE` |
| `PENDING_POOL` | `HOLD_FOR_PRIORITY`, `RELEASE_HOLD`, `CONSIDER_FOR_NO_SHOW`, `CLEAR_NO_SHOW_REVIEW` |

An approval records a reviewed routing candidate; it does not confirm a predicted offload. A pending-pool disposition does not assign or reserve the ULD. The resulting saved record includes a decision ID, work-item/type/ULD/MAWB references, selected option when applicable, decision, reason, reviewer, timestamp, and resulting document version.

`HOLD_FOR_PRIORITY` is allowed while higher-priority demand is active because it protects pool inventory. `CONSIDER_FOR_NO_SHOW` must include the target and validated no-show event; it records review only and never allocates the candidate. A pool decision must not be used to bypass priority gating.

| Decision | Applies to | Required evidence / effect |
|---|---|---|
| `APPROVE_FOR_REVIEW` | Disruption or predicted offload | Requires `optionId`; records the reviewed route only. |
| `REJECT_OVERRIDE` | Disruption or predicted offload | Records the operator's reason; does not confirm or clear the work item. |
| `HOLD_FOR_PRIORITY` | Pending pool | Marks inventory for priority review; does not reserve capacity. |
| `RELEASE_HOLD` | Pending pool | Removes the priority-review marker. |
| `CONSIDER_FOR_NO_SHOW` | Pending pool | Requires target and validated no-show event; records review only. |
| `CLEAR_NO_SHOW_REVIEW` | Pending pool | Clears the no-show review marker. |

| Write result | HTTP status | Client behavior |
|---|---|---|
| Decision saved | `201 Created` | Read the saved decision and resulting document version. |
| Stale document version | `409 Conflict` | Refresh the work item before retrying. |
| Higher-priority gate blocks action | `423 Locked` | Keep the lower-priority action disabled and show blocker IDs. |
| Invalid type, IDs, or decision | `422 Unprocessable Entity` | Show validation details; do not show a success state. |

### Example predicted-offload request

```http
POST /api/v1/recovery-solutions/ULD-HKG-001/decisions
Content-Type: application/json
```

```json
{
  "type": "PREDICTED_OFFLOAD",
  "uldId": "AKE12345CX",
  "masterAirwayBillNumber": "123-45678901",
  "documentVersion": 4,
  "optionId": "R-289-01",
  "decision": "APPROVE_FOR_REVIEW",
  "reason": "Lowest modeled loss among feasible routes; station acceptance still needs confirmation.",
  "reviewerId": "ops-user-104",
  "reviewedAt": "2026-10-16T09:20:00Z"
}
```

### Example confirmed-disruption request

```http
POST /api/v1/recovery-solutions/ULD-HKG-001/decisions
Content-Type: application/json
```

```json
{
  "type": "DISRUPTION",
  "uldId": "AKE12345CX",
  "masterAirwayBillNumber": "123-45678901",
  "documentVersion": 4,
  "optionId": "R-289-01",
  "decision": "APPROVE_FOR_REVIEW",
  "reason": "Confirmed offload; this feasible route has the lowest modeled loss pending station acceptance.",
  "reviewerId": "ops-user-104",
  "reviewedAt": "2026-10-16T09:20:00Z"
}
```

### Example pending-pool request

```json
{
  "type": "PENDING_POOL",
  "uldId": "AKE12345CX",
  "masterAirwayBillNumber": "123-45678901",
  "documentVersion": 5,
  "optionId": null,
  "decision": "HOLD_FOR_PRIORITY",
  "reason": "Protect capacity for disruption and predicted-offload demand.",
  "reviewerId": "ops-user-104",
  "reviewedAt": "2026-10-16T09:25:00Z"
}
```

### Success and error responses

Success returns `201 Created`, a `Location` header for the saved decision, and a response body containing `decisionId`, `workItemId`, `type`, `uldId`, `masterAirwayBillNumber`, `documentVersion`, `decision`, `targetWorkItemId` (nullable), and `reviewedAt`.

Return `409 Conflict` if `documentVersion` is stale, `423 Locked` if a lower-priority action is gated, `422 Unprocessable Entity` if the decision is invalid for the item's type or identifiers do not match, and an appropriate `4xx` or `5xx` for other validation or persistence failures. Do not return success if the MAWB-linked document write failed.

## UI coverage and data boundary

| UI section | API source | Boundary |
|---|---|---|
| **Disruption Alerts** | List/detail filtered to `DISRUPTION`; options and decision endpoints. | Only authoritative confirmed offloads appear in this queue. |
| **Predicted Offload** | List/detail filtered to `PREDICTED_OFFLOAD`; `flightSummaries`; options and decision endpoints. | Flight summaries support triage; predictions and decisions remain ULD-level. |
| **Pending Pool** | List/detail filtered to `PENDING_POOL`; replacement-candidate and decision endpoints. | Review and compatibility only; allocation is external. |
| **Recovery Solution** | Routing options and detailed evaluation for disruption/predicted items. | Records human review; does not book or assign. |
| **Predictive Analytics** | Separate analytics/reporting contract required. | This API does not provide performance history or reporting-period aggregates. |

The list/detail/decision endpoints provide the data for **Disruption Alerts**, **Predicted Offload**, and **Pending Pool**. The options and detailed-evaluation endpoints provide the shared **Recovery Solution** view for disruption and predicted ULDs. The flight summaries support flight-level triage while keeping predictions and decisions at ULD level.

Predictive Analytics performance metrics, forecast-history charts, and reporting-period aggregates are not part of this recovery-solution API. They require a separate analytics/reporting contract; they must not be inferred from the three operational work queues.
