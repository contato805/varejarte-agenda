#!/usr/bin/env python3
"""Render an atomic, initial-only import; no network or remote execution."""
import argparse
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import re
from prepare_migration import prepare

TABLES = {"Employee": "employees", "Client": "clients", "ActivityType": "activity_types",
          "ScheduleEntry": "schedule_entries", "AuditLog": "audit_logs"}


def number(value):
    if value is None or value == "":
        return None
    try:
        result = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError("Número inválido") from error
    if not result.is_finite():
        raise ValueError("Número não finito")
    return str(result)


def boolean(value, default=False):
    if value is None or value == "":
        return default
    if str(value).lower() not in {"true", "false"}:
        raise ValueError("Booleano inválido")
    return str(value).lower() == "true"


def array(value):
    result = json.loads(value) if isinstance(value, str) and value else (value or [])
    if not isinstance(result, list) or any(not isinstance(item, dict) for item in result):
        raise ValueError("Array de objetos esperado")
    return result


def optional_integer(value, maximum):
    normalized = number(value)
    if normalized is None:
        return None
    decimal = Decimal(normalized)
    if decimal != decimal.to_integral_value() or not 1 <= decimal <= maximum:
        raise ValueError("Dia/mês de aniversário inválido")
    return int(decimal)


def activities(value):
    result = array(value)
    for item in result:
        for key in ("quantity", "duration_minutes"):
            numeric = Decimal(number(item.get(key)) or "0")
            if numeric < 0:
                raise ValueError("Quantidade/duração negativa")
            item[key] = int(numeric) if numeric == numeric.to_integral_value() else float(numeric)
    return result


def normalize(entity, raw):
    result = {"id": raw["id"], "is_sample": boolean(raw.get("is_sample")), "deleted_at": None}
    for field in ("created_date", "updated_date"):
        value = raw.get(field)
        if not value:
            raise ValueError(f"{entity}: {field} ausente")
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        result[field] = value
    for field in ("created_by", "created_by_id"):
        result[field] = raw.get(field) or None
    if entity == "Employee":
        result.update({key: raw.get(key) or None for key in ("name", "color", "role", "login")})
        result.update(active=boolean(raw.get("active"), True),
                      access_type=raw.get("access_type") or "viewer",
                      birthday_day=optional_integer(raw.get("birthday_day"), 31),
                      birthday_month=optional_integer(raw.get("birthday_month"), 12),
                      monthly_salary=number(raw.get("monthly_salary")))
        if not result["name"] or not result["color"] or result["access_type"] not in {"admin", "supervisor", "viewer"}:
            raise ValueError("Colaborador inválido")
    elif entity == "Client":
        branches = array(raw.get("branches"))
        for branch in branches:
            branch["active"] = boolean(branch.get("active"), True)
            branch["monthly_activities"] = activities(branch.get("monthly_activities"))
        contacts = array(raw.get("contacts"))
        for contact in contacts:
            for field, maximum in (("birthday_day", 31), ("birthday_month", 12)):
                contact[field] = optional_integer(contact.get(field), maximum)
        result.update(company_name=raw.get("company_name"), active=boolean(raw.get("active"), True),
                      branches=branches, contacts=contacts,
                      monthly_activities=activities(raw.get("monthly_activities")),
                      monthly_contract_value=number(raw.get("monthly_contract_value")),
                      activity_notes=raw.get("activity_notes") or None)
        if not result["company_name"]:
            raise ValueError("Nome do cliente ausente")
    elif entity == "ActivityType":
        result["name"] = raw.get("name")
        if not result["name"]:
            raise ValueError("Nome da atividade ausente")
    elif entity == "ScheduleEntry":
        for field in ("employee_id", "employee_name", "employee_color", "client_id", "client_name", "activity", "date", "start_time", "end_time", "notes"):
            result[field] = raw.get(field) or None
        date.fromisoformat(result["date"] or "")
        for field in ("start_time", "end_time"):
            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", result[field] or ""):
                raise ValueError("Horário inválido")
        result["status"] = raw.get("status") or "agendado"
        if not result["employee_id"] or not result["activity"] or result["status"] not in {"agendado", "realizado", "cancelado"}:
            raise ValueError("Agendamento inválido")
    elif entity == "AuditLog":
        result.pop("deleted_at")
        result.update({key: raw.get(key) for key in ("action", "category", "user_name", "details")})
        if any(not result[key] for key in ("action", "category", "user_name")):
            raise ValueError("Auditoria inválida")
    else:
        raise ValueError("Entidade desconhecida")
    return result


def sql_json(value):
    return "'" + json.dumps(value, ensure_ascii=False, allow_nan=False).replace("'", "''") + "'::jsonb"


def render(records, report):
    normalized = [{**record, "normalized": normalize(record["entity"], record["payload"])} for record in records]
    snapshot = hashlib.sha256(json.dumps(report["entities"], sort_keys=True).encode()).hexdigest()
    encoded = sql_json(normalized)
    marker = "$v_import_" + snapshot + "$"
    while marker in encoded:
        marker = marker[:-1] + "_$"
    inserts = []
    for entity in ("Employee", "Client", "ActivityType", "ScheduleEntry", "AuditLog"):
        table = TABLES[entity]
        inserts.append(f"insert into public.{table} select (jsonb_populate_record(null::public.{table}, normalized)).* from migration_input where entity = '{entity}';")
    empty_checks = " or ".join(f"exists(select 1 from public.{table})" for table in TABLES.values())
    return f"""-- PRIVATE: contains business data. Never commit this generated file.
-- Execute only in the verified, dedicated Varejarte project as database administrator.
begin;
set local standard_conforming_strings = on;
create temporary table migration_input on commit drop as
  select * from jsonb_to_recordset({encoded})
    as r(entity text, legacy_id text, payload jsonb, normalized jsonb);
do {marker}
begin
  if exists(select 1 from base44_migration.import_runs where snapshot_sha256 = '{snapshot}') then
    if (select count(*) from base44_migration.records) <> {len(records)} then
      raise exception 'Snapshot registrado com staging divergente';
    end if;
    return; -- Never overwrite application edits when retrying an imported snapshot.
  end if;
  if {empty_checks} or exists(select 1 from base44_migration.records)
     or exists(select 1 from base44_migration.import_runs) then
    raise exception 'Importação inicial exige tabelas vazias; nenhum dado foi substituído';
  end if;
  insert into base44_migration.records(entity, legacy_id, payload)
    select entity, legacy_id, payload from migration_input;
  {' '.join(inserts)}
  insert into app_private.employee_finances(employee_id, monthly_salary)
    select legacy_id, (normalized->>'monthly_salary')::numeric from migration_input where entity = 'Employee';
  insert into app_private.client_details(client_id, contacts, monthly_contract_value)
    select legacy_id, normalized->'contacts', (normalized->>'monthly_contract_value')::numeric
    from migration_input where entity = 'Client';
  insert into base44_migration.import_runs(snapshot_sha256, manifest)
    values ('{snapshot}', {sql_json(report)});
end {marker};
commit;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records, report = prepare(args.source)
    sql = render(records, report)
    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(args.output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(sql)
    print(f"SQL local preparado para {len(records)} registros; nada executado remotamente.")


if __name__ == "__main__":
    main()
