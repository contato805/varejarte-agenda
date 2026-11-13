import csv
import tempfile
import unittest
from pathlib import Path
from prepare_migration import ENTITIES, prepare, scrub


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for entity in ENTITIES:
            fields = ["id"]
            row = {"id": entity}
            if entity == "ScheduleEntry":
                fields += ["employee_id", "client_id", "notes"]
                row.update(employee_id="Employee", client_id="Client", notes="Texto, com\nquebra")
            if entity == "Employee":
                fields += ["password", "session_token", "session_expires"]
                row.update(password="fixture-secret", session_token="fixture-token", session_expires="old")
            with (self.root / f"{entity}_export.csv").open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerow(row)

    def test_preserves_ids_and_multiline_values_but_removes_credentials(self):
        records, report = prepare(self.root)
        self.assertEqual(report["total_records"], 5)
        employee = next(row for row in records if row["entity"] == "Employee")
        self.assertEqual(employee["legacy_id"], "Employee")
        self.assertEqual(employee["payload"], {"id": "Employee"})
        schedule = next(row for row in records if row["entity"] == "ScheduleEntry")
        self.assertEqual(schedule["payload"]["notes"], "Texto, com\nquebra")

    def test_rejects_orphan_before_generating_snapshot(self):
        path = self.root / "ScheduleEntry_export.csv"
        path.write_text("id,employee_id,client_id\nentry,missing,Client\n")
        with self.assertRaisesRegex(ValueError, "employee_id"):
            prepare(self.root)

    def test_rejects_duplicate_ids(self):
        (self.root / "Client_export.csv").write_text("id\nsame\nsame\n")
        with self.assertRaisesRegex(ValueError, "duplicado"):
            prepare(self.root)

    def test_scrubs_nested_credentials(self):
        self.assertEqual(scrub({"Password": "secret", "items": [{"session_token": "secret", "id": "kept"}]}),
                         {"items": [{"id": "kept"}]})


if __name__ == "__main__":
    unittest.main()
