"""Validate the generated synthetic cargo dataset using only the standard library."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "synthetic_cargo"
FILES = ["shipments", "pieces", "waybills", "bookings", "transport_movements", "loadings", "logistics_events", "recovery_options", "disruption_scenarios"]
REQUIRED = {
    "shipments": ["shipment_id", "origin", "destination", "priority", "cargo_type", "delivery_deadline", "status", "created_at", "updated_at"],
    "pieces": ["piece_id", "shipment_id", "weight_kg", "volume_m3", "handling_code", "temperature_min_c", "temperature_max_c"],
    "waybills": ["waybill_id", "shipment_id", "shipper", "consignee", "air_waybill_number"],
    "bookings": ["booking_id", "shipment_id", "movement_id", "booked_capacity_kg", "booking_status", "booking_cost"],
    "transport_movements": ["movement_id", "flight_number", "origin", "destination", "scheduled_departure", "estimated_departure", "actual_departure", "capacity_remaining_kg", "movement_status"],
    "loadings": ["loading_id", "piece_id", "movement_id", "planned_time", "actual_time", "loading_status"],
    "logistics_events": ["event_id", "shipment_id", "piece_id", "movement_id", "event_type", "event_time", "location", "description", "severity"],
    "recovery_options": ["option_id", "shipment_id", "alternative", "extra_cost", "estimated_arrival", "feasible"],
    "disruption_scenarios": ["scenario_id", "shipment_id", "disruption_type", "description", "expected_detection", "expected_recovery_action"],
}
ID_FIELD = {
    "shipments": "shipment_id", "pieces": "piece_id", "waybills": "waybill_id",
    "bookings": "booking_id", "transport_movements": "movement_id", "loadings": "loading_id",
    "logistics_events": "event_id", "recovery_options": "option_id", "disruption_scenarios": "scenario_id",
}


def dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    data: dict[str, list[dict[str, Any]]] = {}
    for name in FILES:
        path = DATA / f"{name}.json"
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{name}: cannot parse JSON ({exc})")
            continue
        if not isinstance(value, list):
            errors.append(f"{name}: root must be an array")
            continue
        data[name] = value
        ids: set[str] = set()
        for index, record in enumerate(value):
            missing = [field for field in REQUIRED[name] if field not in record]
            if missing:
                errors.append(f"{name}[{index}] missing fields: {', '.join(missing)}")
            identifier = record.get(ID_FIELD[name])
            if identifier in ids:
                errors.append(f"{name}: duplicate identifier {identifier}")
            if identifier is not None:
                ids.add(identifier)
            for field in ("created_at", "updated_at", "event_time", "recorded_at", "planned_time", "actual_time", "cutoff_time", "estimated_arrival", "scheduled_departure", "estimated_departure", "actual_departure", "scheduled_arrival", "actual_arrival", "delivery_deadline", "generated_at"):
                if field in record and record[field] is not None:
                    try:
                        dt(record[field])
                    except (TypeError, ValueError):
                        errors.append(f"{name}[{index}].{field}: invalid ISO timestamp")
    if errors:
        return report(data, errors, warnings)

    shipment_ids = {x["shipment_id"] for x in data["shipments"]}
    piece_ids = {x["piece_id"] for x in data["pieces"]}
    movement_ids = {x["movement_id"] for x in data["transport_movements"]}
    booking_ids = {x["booking_id"] for x in data["bookings"]}
    loading_ids = {x["loading_id"] for x in data["loadings"]}
    for p in data["pieces"]:
        if p["shipment_id"] not in shipment_ids:
            errors.append(f"piece {p['piece_id']}: unknown shipment")
        if p["weight_kg"] <= 0 or p["volume_m3"] <= 0:
            errors.append(f"piece {p['piece_id']}: weight and volume must be positive")
    for s in data["shipments"]:
        related = [p for p in data["pieces"] if p["shipment_id"] == s["shipment_id"]]
        if len(related) != s["piece_count"] or round(sum(p["weight_kg"] for p in related), 2) != s["total_weight_kg"] or round(sum(p["volume_m3"] for p in related), 3) != s["total_volume_m3"]:
            errors.append(f"shipment {s['shipment_id']}: totals do not match pieces")
    for w in data["waybills"]:
        if w["shipment_id"] not in shipment_ids:
            errors.append(f"waybill {w['waybill_id']}: unknown shipment")
    for b in data["bookings"]:
        if b["shipment_id"] not in shipment_ids or b["movement_id"] not in movement_ids:
            errors.append(f"booking {b['booking_id']}: invalid reference")
    for m in data["transport_movements"]:
        if not 0 <= m["capacity_remaining_kg"] <= m["total_capacity_kg"]:
            errors.append(f"movement {m['movement_id']}: invalid remaining capacity")
        if m["movement_status"] == "cancelled" and (m["actual_departure"] or m["actual_arrival"]):
            errors.append(f"movement {m['movement_id']}: cancelled movement has actual operation")
    for l in data["loadings"]:
        if l["piece_id"] not in piece_ids or l["movement_id"] not in movement_ids:
            errors.append(f"loading {l['loading_id']}: invalid reference")
        if l["loading_status"] == "completed" and l["actual_time"] and dt(l["actual_time"]) > dt(l["cutoff_time"]):
            warnings.append(f"loading {l['loading_id']}: completed after cutoff")
        movement = next(m for m in data["transport_movements"] if m["movement_id"] == l["movement_id"])
        if movement["movement_status"] == "cancelled" and l["loading_status"] == "completed":
            errors.append(f"loading {l['loading_id']}: successful load on cancelled movement")
    for e in data["logistics_events"]:
        if e["shipment_id"] not in shipment_ids:
            errors.append(f"event {e['event_id']}: unknown shipment")
        if e["piece_id"] is not None and e["piece_id"] not in piece_ids:
            errors.append(f"event {e['event_id']}: unknown piece")
        if e["movement_id"] is not None and e["movement_id"] not in movement_ids:
            errors.append(f"event {e['event_id']}: unknown movement")
        if e["related_booking_id"] is not None and e["related_booking_id"] not in booking_ids:
            errors.append(f"event {e['event_id']}: unknown booking")
        if e["related_loading_id"] is not None and e["related_loading_id"] not in loading_ids:
            errors.append(f"event {e['event_id']}: unknown loading")
    for r in data["recovery_options"]:
        if r["shipment_id"] not in shipment_ids:
            errors.append(f"recovery {r['option_id']}: unknown shipment")
        for movement_id in r["movement_ids"]:
            if movement_id not in movement_ids:
                errors.append(f"recovery {r['option_id']}: unknown movement")
        shipment = next(s for s in data["shipments"] if s["shipment_id"] == r["shipment_id"])
        deadline_met = dt(r["estimated_arrival"]) <= dt(shipment["delivery_deadline"])
        if r["deadline_met"] != deadline_met:
            errors.append(f"recovery {r['option_id']}: deadline_met is inconsistent")
        if r["feasible"] and not deadline_met:
            errors.append(f"recovery {r['option_id']}: feasible option misses deadline")
    for scenario in data["disruption_scenarios"]:
        if scenario["shipment_id"] not in shipment_ids:
            errors.append(f"scenario {scenario['scenario_id']}: unknown shipment")
        event_ids = {e["event_id"] for e in data["logistics_events"] if e["shipment_id"] == scenario["shipment_id"]}
        if not set(scenario["trigger_event_ids"]).issubset(event_ids):
            errors.append(f"scenario {scenario['scenario_id']}: trigger event does not support shipment")
    return report(data, errors, warnings)


def report(data: dict[str, list[dict[str, Any]]], errors: list[str], warnings: list[str]) -> int:
    print("Synthetic cargo validation")
    for name in FILES:
        print(f"  {name}: {len(data.get(name, []))} records")
    print(f"Validation errors: {len(errors)}")
    for error in errors:
        print(f"  ERROR: {error}")
    print(f"Warnings: {len(warnings)}")
    for warning in warnings[:20]:
        print(f"  WARNING: {warning}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
