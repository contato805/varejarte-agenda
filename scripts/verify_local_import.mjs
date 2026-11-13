// Real exported data stays in memory/local ignored files. No network connections.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { localDatabase } from './local_database.mjs';

const [sourceDirectory, importFile] = process.argv.slice(2);
if (!sourceDirectory || !importFile) throw new Error('Usage: node scripts/verify_local_import.mjs CSV_DIRECTORY IMPORT_SQL');
const tables = { Employee: 'employees', Client: 'clients', ActivityType: 'activity_types', ScheduleEntry: 'schedule_entries', AuditLog: 'audit_logs' };
const extras = new Set(['contacts', 'monthly_contract_value', 'monthly_salary']);

const conversion = spawnSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from prepare_migration import prepare
from render_import import normalize
records, report = prepare(Path(sys.argv[1]))
print(json.dumps([{**r, 'normalized': normalize(r['entity'], r['payload'])} for r in records], ensure_ascii=False))
`, sourceDirectory], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (conversion.status !== 0) throw new Error('Local source conversion failed; no database or network operation performed');
const expected = JSON.parse(conversion.stdout);

let db;
try {
  db = await localDatabase();
  const sql = await readFile(importFile, 'utf8');
  await db.exec(sql);
  for (const [entity, table] of Object.entries(tables)) {
    const rows = (await db.query(`select to_jsonb(t) as record from public.${table} t`)).rows;
    const sourceRows = expected.filter(record => record.entity === entity);
    if (rows.length !== sourceRows.length) throw new Error(`Count mismatch: ${entity}`);
    const actual = new Map(rows.map(({ record }) => [record.id, record]));
    for (const { normalized } of sourceRows) {
      const row = actual.get(normalized.id);
      if (!row) throw new Error(`Missing projected ID: ${entity}`);
      for (const [field, value] of Object.entries(normalized)) {
        if (extras.has(field)) continue;
        const timestamp = ['created_date', 'updated_date'].includes(field);
        const wanted = timestamp ? new Date(value).toISOString() : value;
        const got = timestamp ? new Date(row[field]).toISOString() : row[field];
        if (!isDeepStrictEqual(got, wanted)) throw new Error(`Field mismatch: ${entity}.${field}`);
      }
    }
    console.log(`${entity}: ${rows.length} records; all projected fields match`);
  }
  for (const record of expected.filter(row => row.entity === 'Employee')) {
    const result = await db.query('select monthly_salary is not distinct from $2::numeric as matches from app_private.employee_finances where employee_id = $1', [record.legacy_id, record.normalized.monthly_salary]);
    if (result.rows[0]?.matches !== true) throw new Error('Employee financial parity failed');
  }
  for (const record of expected.filter(row => row.entity === 'Client')) {
    const result = await db.query('select monthly_contract_value is not distinct from $2::numeric as matches, contacts from app_private.client_details where client_id = $1', [record.legacy_id, record.normalized.monthly_contract_value]);
    if (result.rows[0]?.matches !== true || !isDeepStrictEqual(result.rows[0].contacts, record.normalized.contacts)) throw new Error('Client private-data parity failed');
  }
  const staging = (await db.query('select entity, legacy_id, payload from base44_migration.records')).rows;
  const original = new Map(expected.map(record => [`${record.entity}:${record.legacy_id}`, record.payload]));
  if (staging.length !== expected.length || staging.some(row => !isDeepStrictEqual(original.get(`${row.entity}:${row.legacy_id}`), row.payload))) throw new Error('Source snapshot parity failed');
  // A retry must leave legitimate post-import edits untouched.
  await db.query('update public.employees set name = $2 where id = $1', [expected.find(row => row.entity === 'Employee').legacy_id, 'LOCAL RETRY FIXTURE']);
  await db.exec(sql);
  const retry = await db.query("select count(*)::int as count from public.employees where name = 'LOCAL RETRY FIXTURE'");
  if (retry.rows[0].count !== 1) throw new Error('Retry overwrote an application change');
  console.log(`Private financials, contacts and ${staging.length} sanitized snapshots match; retry preserves later edits.`);
  console.log('LOCAL PostgreSQL/WASM verification passed. Hosted Supabase Auth/API/replay remain pending.');
} catch (error) {
  // Never print a driver error object: it can include the entire private SQL statement.
  console.error(`Local import verification failed: ${error.message?.slice(0, 160) || error.code || 'unknown error'}`);
  process.exitCode = 1;
} finally { await db?.close(); }
