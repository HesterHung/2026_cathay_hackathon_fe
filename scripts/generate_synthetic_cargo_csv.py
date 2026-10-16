"""Generate the synthetic cargo dataset as CSV files.

This script reuses the record-building logic from
``generate_synthetic_cargo.py`` but writes CSV files instead of JSON files.
The original generator and its JSON output are not modified.

Nested lists and objects are stored as JSON text inside a CSV cell so that no
information is lost during the conversion.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Iterable

from generate_synthetic_cargo import build_dataset


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "synthetic_cargo_csv"


def csv_value(value: Any) -> Any:
    """Convert nested values to stable text suitable for one CSV cell."""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return value


def write_csv(path: Path, records: Iterable[dict[str, Any]]) -> None:
    """Write records using the union of their keys as the CSV header."""
    rows = list(records)
    fieldnames = list(dict.fromkeys(key for row in rows for key in row))

    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(
            {key: csv_value(value) for key, value in row.items()} for row in rows
        )


def build_metadata(data: dict[str, list[dict[str, Any]]], seed: int) -> dict[str, Any]:
    """Build metadata matching the JSON generator's metadata record."""
    scenario_counts: dict[str, int] = {}
    for scenario in data["disruption_scenarios"]:
        scenario_type = scenario["disruption_type"]
        scenario_counts[scenario_type] = scenario_counts.get(scenario_type, 0) + 1

    return {
        "dataset_name": "Synthetic Cargo Shipment Recovery Optimisation Dataset",
        "dataset_version": "1.0.0",
        "description": "Fictional demonstration records for a cargo recovery hackathon.",
        "generated_at": "2026-09-15T08:00:00Z",
        "synthetic_data": True,
        "currency_default": "USD",
        "timezone_convention": "UTC timestamps with Z suffix",
        "schema_version": "hackathon-cargo-v1",
        "entity_counts": {name: len(records) for name, records in data.items()} | {"metadata": 1},
        "disruption_scenario_counts": scenario_counts,
        "generation_seed": seed,
        "limitations": [
            "Fictional records only",
            "Schedules, carriers, parties, and identifiers are synthetic",
            "Not officially IATA ONE Record compliant",
        ],
        "data_model_reference": "https://www.iata.org/en/programs/cargo/one-record/",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic cargo records as CSV files."
    )
    parser.add_argument("--seed", type=int, default=20261009)
    parser.add_argument("--shipments", type=int, default=100)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()
    if args.shipments < 10:
        parser.error("--shipments must be at least 10 because all disruption scenarios need a shipment")

    data = build_dataset(args.seed, args.shipments)
    args.output.mkdir(parents=True, exist_ok=True)

    for name, records in data.items():
        write_csv(args.output / f"{name}.csv", records)
    write_csv(args.output / "metadata.csv", [build_metadata(data, args.seed)])


if __name__ == "__main__":
    main()
