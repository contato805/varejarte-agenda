import unittest
from render_import import normalize, render

BASE = {"id": "legacy-id", "created_date": "2026-11-01T00:00:00Z", "updated_date": "2026-11-02T00:00:00Z"}


class ConversionTests(unittest.TestCase):
    def test_nested_client_numbers_and_birthdays(self):
        row = normalize("Client", {**BASE, "company_name": "Cliente teste",
            "monthly_contract_value": "123.45", "contacts": '[{"birthday_day":"2","birthday_month":"3"}]',
            "branches": '[{"name":"Filial", "monthly_activities":[{"quantity":"2","duration_minutes":"30"}]}]'})
        self.assertEqual(row["monthly_contract_value"], "123.45")
        self.assertEqual(row["contacts"][0]["birthday_day"], 2)
        self.assertEqual(row["branches"][0]["monthly_activities"][0]["quantity"], 2)

    def test_unknown_fields_and_credentials_do_not_enter_projection(self):
        row = normalize("Employee", {**BASE, "name": "Teste", "color": "#123456", "password": "secret", "session_token": "secret", "unknown": "legacy"})
        self.assertNotIn("password", row)
        self.assertNotIn("session_token", row)
        self.assertNotIn("unknown", row)
        self.assertEqual(row["id"], "legacy-id")

    def test_invalid_financial_numbers_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize("Client", {**BASE, "company_name": "Teste", "monthly_contract_value": "NaN"})

    def test_invalid_calendar_values_are_rejected(self):
        row = {**BASE, "employee_id": "e1", "client_id": "c1", "activity": "Teste", "date": "2026-02-31", "start_time": "08:00", "end_time": "09:00"}
        with self.assertRaises(ValueError): normalize("ScheduleEntry", row)
        row.update(date="2026-02-01", start_time="25:00")
        with self.assertRaises(ValueError): normalize("ScheduleEntry", row)

    def test_import_escapes_sql_literals_and_preserves_snapshot(self):
        row = {**BASE, "name": "Cliente d'água"}
        report = {"entities": {"ActivityType": {"rows": 1, "sha256": "fixture"}}}
        sql = render([{"entity": "ActivityType", "legacy_id": row["id"], "payload": row}], report)
        self.assertIn("d''água", sql)
        self.assertIn("begin;", sql)
        self.assertTrue(sql.endswith("commit;\n"))


if __name__ == "__main__": unittest.main()
