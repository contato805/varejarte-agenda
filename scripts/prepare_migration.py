#!/usr/bin/env python3
"""Validate Base44 CSV exports and prepare a private, credential-free snapshot.

Only writes local files. Never connects to Base44, GitHub or Supabase.
"""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path

ENTITIES = ("ActivityType", "AuditLog", "Client", "Employee", "ScheduleEntry")
SENSITIVE_KEYS = {"password", "session_token", "session_expires", "access_token", "refresh_token"}


def scrub(value):
    if isinstance(value, dict):
        return {key: scrub(item) for key, item in value.items()
                if key.lower() not in SENSITIVE_KEYS}
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def prepare(source):
    data, inventory = {}, {}
    for entity in ENTITIES:
        path = source / f"{entity}_export.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames or "id" not in reader.fieldnames:
                raise ValueError(f"{entity}: coluna id ausente")
            rows = list(reader)
        if any(None in row or any(value is None for value in row.values()) for row in rows):
            raise ValueError(f"{entity}: CSV com colunas inconsistentes")
        ids = [row["id"] for row in rows]
        if any(not value.strip() for value in ids) or len(ids) != len(set(ids)):
            raise ValueError(f"{entity}: ID vazio ou duplicado")
        data[entity] = rows
        inventory[entity] = {"rows": len(rows), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    for field, parent in (("employee_id", "Employee"), ("client_id", "Client")):
        parent_ids = {row["id"] for row in data[parent]}
        if any(field not in row or row[field] not in parent_ids for row in data["ScheduleEntry"]):
            raise ValueError(f"ScheduleEntry: referência inválida em {field}")

    records = [{"entity": entity, "legacy_id": row["id"], "payload": scrub(row)}
               for entity in ENTITIES for row in data[entity]]
    return records, {"entities": inventory, "total_records": len(records),
                     "duplicate_ids": 0, "unresolved_schedule_references": 0,
                     "credentials_removed": sorted(SENSITIVE_KEYS),
                     "format": "CSV values preserved as strings; structured parsing deferred",
                     "status": "validated_local_snapshot_only"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Pasta contendo as cinco exportações CSV")
    parser.add_argument("--output", type=Path, default=Path(".migration/prepared"))
    args = parser.parse_args()
    records, report = prepare(args.source)
    # A new directory keeps previous snapshots intact and avoids mixing exports.
    args.output.mkdir(parents=True, exist_ok=False, mode=0o700)
    for name, value in (("records.json", records), ("report.json", report)):
        target = args.output / name
        fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
