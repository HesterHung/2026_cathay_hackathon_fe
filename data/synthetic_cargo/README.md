# Synthetic Cargo Shipment Recovery Optimisation Dataset

This directory contains fictional, deterministic air-cargo records for the
hackathon project **Cargo Shipment Recovery Optimisation**. The data is for
demonstration and testing only: names, identifiers, flights, schedules, and
addresses are invented. This simplified schema is conceptually informed by
IATA ONE Record, but it is **not officially ONE Record compliant**.

## Files and relationships

- `shipments.json` contains one consignment per shipment.
- `pieces.json` contains the physical packages belonging to shipments.
- `waybills.json` contains one primary air waybill per shipment.
- `bookings.json` contains original bookings and proposed recovery bookings.
- `transport_movements.json` contains fictional flight legs and capacities.
- `loadings.json` records piece-level load attempts, including failures.
- `logistics_events.json` contains chronological shipment and operations events.
- `recovery_options.json` contains feasible and rejected recovery candidates.
- `disruption_scenarios.json` contains ten repeatable positive and negative tests.
- `metadata.json` describes the generated dataset and record counts.

The main relationship chain is `shipment -> pieces`, `shipment -> waybill`,
`shipment -> bookings -> transport movement`, and `piece -> loading ->
transport movement`. Events and recovery options reference the same identifiers.
Identifiers use stable prefixes such as `SHP-0001`, `PCE-0001-01`, `TM-0001`,
and `EVT-00001`.

All timestamps are UTC ISO 8601 strings with a `Z` suffix. Monetary values use
ISO 4217 `USD`; airports use IATA three-letter codes and countries use
ISO 3166-1 alpha-2 codes.

## Scenarios and recovery evaluation

The scenarios cover a missed cutoff, delay, cancellation, customs delay,
capacity shortage, temperature excursion, missing tracking update, multiple
disruptions, no feasible recovery, and a normal shipment. Recovery candidates
are evaluated against arrival deadlines, movement status, capacity, and the
recorded handling requirement. Rejected options explain their infeasibility;
only feasible options receive a recommendation rank.

## Regeneration and validation

From the repository root:

```text
python scripts/generate_synthetic_cargo.py
python scripts/validate_synthetic_cargo.py
```

The default seed is `20261009`. It can be overridden with `--seed`; the number
of shipments can be changed with `--shipments`. The generator uses Python's
standard library and requires no network access or credentials.

## Limitations

This is a compact synthetic dataset, not a production operational system.
Schedules are illustrative, capacity allocation is simplified, connections are
represented as candidate legs rather than a complete network optimizer, and the
schema omits many official ONE Record objects and vocabulary constraints.
