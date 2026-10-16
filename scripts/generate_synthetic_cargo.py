"""Generate a deterministic, self-contained synthetic air-cargo dataset.

The records intentionally use a small hackathon-friendly schema inspired by
IATA ONE Record concepts. They are fictional and are not official ONE Record
documents or live airline data.
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "synthetic_cargo"
UTC = timezone.utc
AIRPORTS = ["SIN", "HKG", "DOH", "DXB", "FRA", "LHR", "SYD", "NRT"]
ROUTES = [
    ("SIN", "HKG"), ("HKG", "FRA"), ("SIN", "DOH"), ("DOH", "LHR"),
    ("DXB", "FRA"), ("FRA", "LHR"), ("NRT", "SYD"), ("SYD", "SIN"),
    ("HKG", "NRT"), ("DXB", "LHR"), ("SIN", "FRA"), ("FRA", "SYD"),
]
CARGO_TYPES = ["pharmaceuticals", "perishables", "electronics", "automotive parts", "general cargo"]
TEMP_RANGES = {
    "pharmaceuticals": (2, 8),
    "perishables": (0, 5),
    "electronics": (None, None),
    "automotive parts": (None, None),
    "general cargo": (None, None),
}


def iso(value: datetime | None) -> str | None:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z") if value else None


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_dataset(seed: int, shipment_count: int) -> dict[str, Any]:
    rng = random.Random(seed)
    now = datetime(2026, 9, 15, 8, tzinfo=UTC)
    movements: list[dict[str, Any]] = []
    for i in range(50):
        origin, destination = ROUTES[i % len(ROUTES)]
        departure = now + timedelta(hours=6 + i * 5)
        duration = 5 + (i % 5) * 2
        status = "scheduled"
        delay = 0
        cancellation_reason = None
        if i == 0:
            status, cancellation_reason = "cancelled", "AIRCRAFT_MAINTENANCE"
        elif i in (1, 2):
            status, delay = "delayed", 180 + i * 30
        arrival = departure + timedelta(hours=duration)
        movements.append({
            "movement_id": f"TM-{i + 1:04d}",
            "flight_number": f"CX{700 + i:03d}",
            "carrier_code": "CX",
            "movement_type": "flight",
            "origin": origin,
            "destination": destination,
            "scheduled_departure": iso(departure),
            "estimated_departure": iso(departure + timedelta(minutes=delay)) if status != "cancelled" else None,
            "actual_departure": iso(departure + timedelta(minutes=delay + 5)) if i in (2,) else None,
            "scheduled_arrival": iso(arrival),
            "estimated_arrival": iso(arrival + timedelta(minutes=delay)) if status != "cancelled" else None,
            "actual_arrival": iso(arrival + timedelta(minutes=delay + 10)) if i == 2 else None,
            "total_capacity_kg": 18000 + (i % 4) * 2500,
            "capacity_remaining_kg": 7000 + (i % 6) * 900,
            "capacity_remaining_m3": 35.0 + (i % 5) * 4.0,
            "aircraft_type": ["A350F", "B777F", "B747F"][i % 3],
            "is_temperature_controlled": i % 4 != 0,
            "temperature_capability_min_c": -20 if i % 4 != 0 else None,
            "temperature_capability_max_c": 25 if i % 4 != 0 else None,
            "operational_cost": 18000 + i * 125,
            "currency": "USD",
            "delay_minutes": delay,
            "cancellation_reason": cancellation_reason,
            "movement_status": status,
            "created_at": iso(now - timedelta(days=2)),
            "updated_at": iso(now + timedelta(hours=i)),
        })

    shipments: list[dict[str, Any]] = []
    pieces: list[dict[str, Any]] = []
    waybills: list[dict[str, Any]] = []
    bookings: list[dict[str, Any]] = []
    loadings: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    recovery: list[dict[str, Any]] = []
    scenario_flags = {
        0: ("missed_loading_cutoff", "disrupted"),
        1: ("flight_delay", "disrupted"),
        2: ("flight_cancellation", "disrupted"),
        3: ("customs_clearance_delay", "disrupted"),
        4: ("capacity_shortage", "disrupted"),
        5: ("temperature_excursion", "disrupted"),
        6: ("missing_tracking_update", "disrupted"),
        7: ("multiple_disruptions", "disrupted"),
        8: ("no_feasible_recovery", "disrupted"),
        9: ("normal_operation", "normal"),
    }
    scenario_trigger_ids: dict[int, list[str]] = {}
    scenario_option_ids: dict[int, list[str]] = {}

    for s in range(shipment_count):
        cargo = CARGO_TYPES[s % len(CARGO_TYPES)]
        origin, destination = ROUTES[(s + 2) % len(ROUTES)]
        if s in (0, 2):
            origin, destination = "SIN", "HKG"
        movement_index = 0 if s == 0 else 1 if s == 1 else 2 if s == 2 else 3 + (s % 47)
        movement = movements[movement_index]
        created = now - timedelta(days=2) + timedelta(minutes=s * 11)
        depart = datetime.fromisoformat(movement["scheduled_departure"].replace("Z", "+00:00"))
        deadline = depart + timedelta(hours=10 + (s % 4) * 3)
        if s >= 2 and s != 8:
            deadline = depart + timedelta(hours=72)
        count = 1 + (s % 3)
        weights = [round(80 + rng.random() * 420, 2) for _ in range(count)]
        volumes = [round(w / (260 + rng.random() * 80), 3) for w in weights]
        min_temp, max_temp = TEMP_RANGES[cargo]
        status = scenario_flags.get(s, (None, "normal" if s < 70 else "at_risk"))[1]
        if s in range(10, 21):
            status = "disrupted"
        if s in (70, 71, 72, 73, 74, 75, 76, 77, 78, 79):
            status = "at_risk"
        disruption_status = "none" if status == "normal" else "at_risk" if status == "at_risk" else "disrupted"
        shipment_id = f"SHP-{s + 1:04d}"
        movement_id = movement["movement_id"]
        shipments.append({
            "shipment_id": shipment_id, "origin": origin, "destination": destination,
            "priority": ["critical", "high", "normal", "low"][s % 4], "cargo_type": cargo,
            "delivery_deadline": iso(deadline), "status": "delivered" if status == "normal" and s % 3 == 0 else "in_transit",
            "created_at": iso(created), "updated_at": iso(created + timedelta(hours=4)),
            "total_weight_kg": round(sum(weights), 2), "total_volume_m3": round(sum(volumes), 3),
            "piece_count": count, "temperature_min_c": min_temp, "temperature_max_c": max_temp,
            "special_handling_codes": ["COL" if min_temp is not None else "GEN"],
            "shipper_id": f"PTY-SH-{s + 1:04d}", "consignee_id": f"PTY-CO-{s + 1:04d}",
            "waybill_id": f"WB-{s + 1:04d}", "current_location": origin,
            "current_movement_id": movement_id, "disruption_status": disruption_status,
            "risk_score": 82 if disruption_status == "disrupted" else 55 if disruption_status == "at_risk" else 8 + s % 15,
            "estimated_delivery_time": iso(deadline - timedelta(hours=1)) if status == "normal" else None,
        })
        for p in range(count):
            piece_id = f"PCE-{s + 1:04d}-{p + 1:02d}"
            pieces.append({
                "piece_id": piece_id, "shipment_id": shipment_id, "piece_number": p + 1,
                "weight_kg": weights[p], "volume_m3": volumes[p], "handling_code": "COL" if min_temp is not None else "GEN",
                "temperature_min_c": min_temp, "temperature_max_c": max_temp,
                "dimensions_cm": {"length": 60 + p * 5, "width": 45, "height": 40},
                "package_type": "carton" if p % 2 else "pallet", "current_location": origin,
                "piece_status": "ready_for_carriage" if status != "normal" else "delivered",
                "loaded_movement_id": None if s in (0, 2) else movement_id,
                "created_at": iso(created), "updated_at": iso(created + timedelta(hours=4)),
            })
        party_shipper = {"party_id": f"PTY-SH-{s + 1:04d}", "name": f"Fictional Exporter {s + 1:03d}",
                         "address": f"{10 + s} Harbour Way", "city": origin, "country_code": ["SG", "HK", "QA", "AE", "DE", "GB", "AU", "JP"][s % 8]}
        party_consignee = {"party_id": f"PTY-CO-{s + 1:04d}", "name": f"Fictional Importer {s + 1:03d}",
                           "address": f"{20 + s} Cargo Avenue", "city": destination, "country_code": ["HK", "DE", "QA", "GB", "AE", "AU", "SG", "JP"][s % 8]}
        waybills.append({
            "waybill_id": f"WB-{s + 1:04d}", "shipment_id": shipment_id, "shipper": party_shipper,
            "consignee": party_consignee, "air_waybill_number": f"160-{s + 1:08d}",
            "issuing_carrier": "Cathay Cargo (fictional)", "issue_date": iso(created),
            "origin": origin, "destination": destination, "total_pieces": count,
            "total_weight_kg": round(sum(weights), 2), "currency": "USD", "declared_value": 15000 + s * 275,
            "waybill_status": "issued",
        })
        booking_id = f"BKG-{s + 1:04d}-01"
        bookings.append({
            "booking_id": booking_id, "shipment_id": shipment_id, "movement_id": movement_id,
            "booked_capacity_kg": round(sum(weights) + 100, 2), "booking_status": "cancelled" if s == 2 else "confirmed",
            "booking_cost": 2200 + s * 37, "booking_reference": f"REF-{s + 1:05d}",
            "booking_date": iso(created), "service_type": "priority air freight" if s % 4 == 0 else "standard air freight",
            "origin": origin, "destination": destination, "planned_departure": movement["scheduled_departure"],
            "planned_arrival": movement["scheduled_arrival"], "currency": "USD",
            "allocated_capacity_kg": round(sum(weights) + 50, 2),
            "special_handling_requirements": ["temperature_controlled"] if min_temp is not None else [],
            "last_updated": iso(created + timedelta(hours=4)),
        })
        if status == "disrupted":
            alt_id = f"BKG-{s + 1:04d}-02"
            alt_movement = movements[(movement_index + 4) % len(movements)]
            bookings.append({
                "booking_id": alt_id, "shipment_id": shipment_id, "movement_id": alt_movement["movement_id"],
                "booked_capacity_kg": round(sum(weights) + 100, 2), "booking_status": "proposed",
                "booking_cost": 3100 + s * 41, "booking_reference": f"REC-{s + 1:05d}",
                "booking_date": iso(created + timedelta(hours=5)), "service_type": "recovery air freight",
                "origin": alt_movement["origin"], "destination": alt_movement["destination"],
                "planned_departure": alt_movement["scheduled_departure"], "planned_arrival": alt_movement["scheduled_arrival"],
                "currency": "USD", "allocated_capacity_kg": round(sum(weights) + 100, 2),
                "special_handling_requirements": ["temperature_controlled"] if min_temp is not None else [],
                "last_updated": iso(created + timedelta(hours=5)),
            })
        for p in range(count):
            piece_id = f"PCE-{s + 1:04d}-{p + 1:02d}"
            missed = s == 0
            planned = depart - timedelta(minutes=90)
            actual = planned + timedelta(minutes=45) if missed else planned - timedelta(minutes=30)
            loadings.append({
                "loading_id": f"LOD-{s + 1:04d}-{p + 1:02d}", "piece_id": piece_id, "movement_id": movement_id,
                "planned_time": iso(planned), "actual_time": iso(actual) if not (s == 2) else None,
                "loading_status": "failed" if missed or s == 2 else "completed",
                "operation_type": "load", "location": origin, "handling_unit_id": f"ULD-{s + 1:04d}" if not missed else None,
                "cutoff_time": iso(depart - timedelta(minutes=120)), "failure_reason": "CUTOFF_MISSED" if missed else "FLIGHT_CANCELLED" if s == 2 else None,
                "recorded_at": iso(actual + timedelta(minutes=5)), "updated_at": iso(actual + timedelta(minutes=5)),
            })
        base_events = [
            ("BOOKING_CONFIRMED", created + timedelta(minutes=10), origin, False, "booking"),
            ("CARGO_RECEIVED", created + timedelta(minutes=30), origin, False, "shipment"),
            ("SECURITY_SCREENING_COMPLETED", created + timedelta(hours=1), origin, False, "shipment"),
        ]
        if s == 3:
            base_events.append(("CUSTOMS_HOLD", depart - timedelta(hours=2), origin, True, "shipment"))
        if s == 4:
            base_events.append(("CAPACITY_SHORTAGE", depart - timedelta(hours=3), origin, True, "movement"))
        if s == 5:
            base_events.append(("TEMPERATURE_EXCURSION", depart - timedelta(hours=1), origin, True, "shipment"))
        if s == 6:
            base_events.append(("TRACKING_UPDATE_MISSING", depart - timedelta(hours=1), origin, True, "shipment"))
        if s == 7:
            base_events.extend([("FLIGHT_DELAYED", depart, origin, True, "movement"), ("CUSTOMS_HOLD", depart + timedelta(hours=1), origin, True, "shipment")])
        if s == 0:
            base_events.append(("LOADING_CUTOFF_MISSED", depart - timedelta(minutes=30), origin, True, "loading"))
        if s == 1:
            base_events.append(("FLIGHT_DELAYED", depart, origin, True, "movement"))
        if s == 2:
            base_events.append(("FLIGHT_CANCELLED", depart - timedelta(minutes=30), origin, True, "movement"))
        if status == "normal":
            base_events.extend([("LOADING_STARTED", depart - timedelta(minutes=100), origin, False, "loading"), ("CARGO_LOADED", depart - timedelta(minutes=80), origin, False, "loading"), ("FLIGHT_DEPARTED", depart, origin, False, "movement"), ("FLIGHT_ARRIVED", depart + timedelta(hours=8), destination, False, "movement")])
        for e, event_time, location, exception, kind in base_events:
            event_id = f"EVT-{len(events) + 1:05d}"
            scenario_trigger_ids.setdefault(s, []).append(event_id)
            events.append({
                "event_id": event_id, "shipment_id": shipment_id, "piece_id": None, "movement_id": movement_id if kind == "movement" else None,
                "event_type": e, "event_time": iso(event_time), "location": location,
                "description": e.replace("_", " ").title(), "severity": "high" if exception else "info",
                "event_source": "synthetic_operations", "event_status": "confirmed", "recorded_at": iso(event_time + timedelta(minutes=5)),
                "is_exception": exception, "related_booking_id": booking_id if kind == "booking" else None,
                "related_loading_id": f"LOD-{s + 1:04d}-01" if kind == "loading" else None,
                "metadata": {"synthetic": True, "scenario_key": scenario_flags.get(s, (None, None))[0]},
            })
    # Add recovery candidates after all movements/bookings exist.
    for s, shipment in enumerate(shipments):
        if shipment["disruption_status"] != "disrupted":
            continue
        original = f"BKG-{s + 1:04d}-01"
        option_ids: list[str] = []
        for j in range(3):
            oid = f"REC-{s + 1:04d}-{j + 1:02d}"
            option_ids.append(oid)
            alt = movements[(s + j + 5) % len(movements)]
            arrival = datetime.fromisoformat(alt["scheduled_arrival"].replace("Z", "+00:00"))
            deadline = datetime.fromisoformat(shipment["delivery_deadline"].replace("Z", "+00:00"))
            feasible = s != 8 and j == 0 and alt["movement_status"] != "cancelled" and arrival <= deadline and alt["capacity_remaining_kg"] >= shipment["total_weight_kg"]
            reasons = [] if feasible else ["Estimated arrival misses hard delivery deadline"] if s == 8 else ["Candidate movement does not satisfy the preferred recovery ranking"]
            recovery.append({
                "option_id": oid, "shipment_id": shipment["shipment_id"], "alternative": f"Use synthetic flight {alt['flight_number']} via {alt['origin']}",
                "extra_cost": 900 + j * 450, "estimated_arrival": iso(arrival), "feasible": feasible,
                "option_type": ["rebook", "reroute", "wait_for_next_flight"][j],
                "original_booking_id": original,                 "alternative_booking_id": f"BKG-{s + 1:04d}-02",
                "movement_ids": [alt["movement_id"]], "additional_transit_minutes": 90 + j * 120,
                "delivery_delay_minutes": max(0, int((arrival - datetime.fromisoformat(shipment["delivery_deadline"].replace("Z", "+00:00"))).total_seconds() / 60)),
                "risk_score": 22 + j * 17, "risk_factors": ["synthetic capacity check"] if feasible else ["deadline or operational constraint"],
                "infeasibility_reasons": reasons, "currency": "USD", "cost_breakdown": {"transport": 700 + j * 300, "handling": 200 + j * 150},
                "score": 92 - j * 18 if feasible else 20 - j, "recommendation_rank": j + 1 if feasible else None,
                "deadline_met": arrival <= deadline,
                "capacity_available": alt["capacity_remaining_kg"] >= shipment["total_weight_kg"],
                "handling_requirements_met": True, "generated_at": iso(now),
                "recommendation_reason": "Highest-scoring feasible synthetic recovery" if feasible else "Rejected by hard or operational constraints",
            })
        scenario_option_ids[s] = option_ids
    scenarios = []
    scenario_names = [
        ("missed_loading_cutoff", 0), ("flight_delay", 1), ("flight_cancellation", 2), ("customs_clearance_delay", 3),
        ("capacity_shortage", 4), ("temperature_excursion", 5), ("missing_tracking_update", 6), ("multiple_disruptions", 7),
        ("no_feasible_recovery", 8), ("normal_operation", 9),
    ]
    for i, (kind, s) in enumerate(scenario_names, 1):
        positive = s != 9
        scenarios.append({
            "scenario_id": f"SCN-{i:03d}", "shipment_id": shipments[s]["shipment_id"], "disruption_type": kind,
            "description": f"Synthetic test case for {kind.replace('_', ' ')}.", "expected_detection": "Flag shipment" if positive else "Do not flag shipment",
            "expected_recovery_action": "Evaluate recovery options" if positive else "Continue normal monitoring",
            "severity": "high" if positive else "none", "trigger_event_ids": scenario_trigger_ids.get(s, []),
            "affected_piece_ids": [p["piece_id"] for p in pieces if p["shipment_id"] == shipments[s]["shipment_id"]],
            "affected_movement_ids": [shipments[s]["current_movement_id"]], "expected_impact": "Delivery risk" if positive else "No disruption",
            "expected_delivery_delay_minutes": 240 if positive else 0,             "expected_feasible_option_ids": [o["option_id"] for o in recovery if o["shipment_id"] == shipments[s]["shipment_id"] and o["feasible"]],
            "expected_recommended_option_id": next((o["option_id"] for o in recovery if o["shipment_id"] == shipments[s]["shipment_id"] and o["feasible"]), None),
            "test_assertions": ["Shipment disruption status matches scenario expectation", "All trigger events reference this shipment"],
        })
    return {
        "shipments": shipments, "pieces": pieces, "waybills": waybills, "bookings": bookings,
        "transport_movements": movements, "loadings": loadings, "logistics_events": events,
        "recovery_options": recovery, "disruption_scenarios": scenarios,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic cargo JSON records.")
    parser.add_argument("--seed", type=int, default=20261009)
    parser.add_argument("--shipments", type=int, default=100)
    args = parser.parse_args()
    data = build_dataset(args.seed, args.shipments)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, records in data.items():
        write_json(OUT / f"{name}.json", records)
    counts = {name: len(records) for name, records in data.items()}
    counts["metadata"] = 1
    scenario_counts: dict[str, int] = {}
    for scenario in data["disruption_scenarios"]:
        scenario_counts[scenario["disruption_type"]] = scenario_counts.get(scenario["disruption_type"], 0) + 1
    write_json(OUT / "metadata.json", {
        "dataset_name": "Synthetic Cargo Shipment Recovery Optimisation Dataset",
        "dataset_version": "1.0.0", "description": "Fictional demonstration records for a cargo recovery hackathon.",
        "generated_at": "2026-09-15T08:00:00Z", "synthetic_data": True, "currency_default": "USD",
        "timezone_convention": "UTC timestamps with Z suffix", "schema_version": "hackathon-cargo-v1",
        "entity_counts": counts, "disruption_scenario_counts": scenario_counts, "generation_seed": args.seed,
        "limitations": ["Fictional records only", "Schedules, carriers, parties, and identifiers are synthetic", "Not officially IATA ONE Record compliant"],
        "data_model_reference": "https://www.iata.org/en/programs/cargo/one-record/",
    })


if __name__ == "__main__":
    main()
