import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { localDatabase } from '../scripts/local_database.mjs';

let db;
const admin = '00000000-0000-0000-0000-000000000001';
const supervisor = '00000000-0000-0000-0000-000000000002';
const viewer = '00000000-0000-0000-0000-000000000003';
const stranger = '00000000-0000-0000-0000-000000000004';

before(async () => {
  db = await localDatabase();
  await db.exec(`
    insert into auth.users values ('${admin}'), ('${supervisor}'), ('${viewer}'), ('${stranger}');
    insert into public.employees(id, name, color, access_type) values
      ('e1', 'Administrador teste', '#112233', 'admin'),
      ('e2', 'Supervisor teste', '#223344', 'supervisor'),
      ('e3', 'Visualizador teste', '#334455', 'viewer');
    insert into app_private.user_access(user_id, employee_id) values
      ('${admin}', 'e1'), ('${supervisor}', 'e2'), ('${viewer}', 'e3');
    insert into public.clients(id, company_name) values ('c1', 'Cliente sintético'), ('c2', 'Outro cliente sintético');
    insert into app_private.employee_finances values ('e1', 100), ('e2', 200), ('e3', 300);
    insert into app_private.client_details values ('c1', '[{"name":"Contato teste"}]', 500);
    insert into public.schedule_entries(id, employee_id, client_id, activity, date, start_time, end_time) values
      ('s1', 'e1', 'c1', 'Atividade teste', '2026-11-01', '08:00', '09:00'),
      ('s2', 'e2', 'c1', 'Atividade teste', '2026-11-01', '08:00', '09:00'),
      ('s3', 'e3', 'c1', 'Atividade teste', '2026-11-01', '23:00', '00:00');
  `);
});
after(async () => { await db?.close(); });

async function asUser(id, callback) {
  await db.exec('begin; set local role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  try { return await callback(); } finally { await db.exec('rollback;'); }
}
async function denied(sql) {
  await db.exec('savepoint denial;');
  try { await assert.rejects(db.exec(sql), error => error.code === '42501'); }
  finally { await db.exec('rollback to denial; release denial;'); }
}

test('viewer sees only own schedule and own employee; private data and writes are denied', async () => {
  await asUser(viewer, async () => {
    assert.deepEqual((await db.query('select id from public.schedule_entries')).rows, [{ id: 's3' }]);
    const employees = (await db.query('select public.employee_records() as record')).rows;
    assert.equal(employees.length, 1);
    assert.equal(employees[0].record.monthly_salary, null);
    const clients = (await db.query('select public.client_records() as record')).rows;
    assert.equal(clients.length, 1);
    assert.deepEqual((await db.query('select id from public.clients')).rows, [{ id: 'c1' }]);
    assert.deepEqual(clients[0].record.contacts, []);
    assert.equal(clients[0].record.monthly_contract_value, null);
    await denied('select * from app_private.employee_finances');
    await denied('select * from app_private.user_access');
    await denied("insert into public.clients(company_name) values ('Não permitido')");
    assert.equal((await db.query("update public.schedule_entries set notes = 'não' returning id")).rows.length, 0);
    assert.equal((await db.query("update public.employees set access_type = 'admin' returning id")).rows.length, 0);
  });
});

test('supervisor reads all schedules without financial data or write access', async () => {
  await asUser(supervisor, async () => {
    assert.equal((await db.query('select id from public.schedule_entries')).rows.length, 3);
    const rows = (await db.query('select public.employee_records() as record')).rows;
    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => row.record.monthly_salary === null));
    await denied("insert into public.activity_types(name) values ('Não permitido')");
    assert.equal((await db.query("update public.clients set active = false returning id")).rows.length, 0);
  });
});

test('administrator can read financials and edit application data', async () => {
  await asUser(admin, async () => {
    const rows = (await db.query('select public.employee_records() as record')).rows;
    assert.equal(rows.find(row => row.record.id === 'e3').record.monthly_salary, 300);
    const clients = (await db.query('select public.client_records() as record')).rows;
    assert.equal(clients.find(row => row.record.id === 'c1').record.monthly_contract_value, 500);
    assert.equal(clients.find(row => row.record.id === 'c1').record.contacts.length, 1);
    assert.equal((await db.query("update public.schedule_entries set notes = 'teste' returning id")).rows.length, 3);
    await denied('select * from app_private.user_access');
  });
});

test('authenticated account without a server-owned mapping has no application access', async () => {
  await asUser(stranger, async () => {
    assert.equal((await db.query('select public.current_actor() as actor')).rows[0].actor, null);
    assert.equal((await db.query('select id from public.schedule_entries')).rows.length, 0);
    await denied('select public.employee_records()');
    await denied("insert into public.clients(company_name) values ('Não permitido')");
  });
});

test('disabled employee loses access despite having a valid identity mapping', async () => {
  await db.exec("update public.employees set active = false where id = 'e3'");
  try {
    await asUser(viewer, async () => {
      assert.equal((await db.query('select public.current_actor() as actor')).rows[0].actor, null);
      assert.equal((await db.query('select id from public.schedule_entries')).rows.length, 0);
    });
  } finally { await db.exec("update public.employees set active = true where id = 'e3'"); }
});

test('anonymous role has no direct access to business data or private readers', async () => {
  await db.exec('begin; set local role anon;');
  try {
    await denied('select * from public.clients');
    await denied('select public.current_actor()');
    await denied('select public.client_records()');
    await denied('select * from base44_migration.records');
  } finally { await db.exec('rollback;'); }
});

test('upgrade from populated staging preserves the existing source snapshot', async () => {
  const upgrade = await localDatabase({ stagingOnly: true });
  try {
    await upgrade.exec("insert into base44_migration.records values ('Client', 'legacy', '{\"id\":\"legacy\"}', now())");
    await upgrade.exec(await readFile(new URL('../supabase/migrations/20261113200000_create_agenda_model.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await upgrade.query('select legacy_id from base44_migration.records')).rows, [{ legacy_id: 'legacy' }]);
  } finally { await upgrade.close(); }
});

test('exported metadata timestamps retain their wall time and microseconds', async () => {
  await asUser(admin, async () => {
    const result = await db.query(`insert into public.activity_types(name, created_date)
      values ('Relógio teste', '2026-11-01T10:15:20.123456') returning to_jsonb(created_date) as value`);
    assert.equal(result.rows[0].value, '2026-11-01T10:15:20.123456');
  });
});

function fixtureImport(entity, extra) {
  const payload = { id: 'fixture', created_date: '2026-11-01T10:15:20.123456', updated_date: '2026-11-01T10:15:20.123456', ...extra };
  const result = spawnSync('python3', ['-c', `
import json, sys
sys.path.insert(0, 'scripts')
from render_import import render
record = json.load(sys.stdin)
print(render([record], {'entities': {record['entity']: {'rows': 1, 'sha256': 'fixture'}}}))
`], { input: JSON.stringify({ entity, legacy_id: payload.id, payload }), encoding: 'utf8' });
  assert.equal(result.status, 0, 'Fixture import generation succeeds');
  return result.stdout;
}

test('initial import executes escaped text safely and retries without overwriting later edits', async () => {
  const imported = await localDatabase();
  try {
    const name = "D'água $$ ; -- fixture";
    const sql = fixtureImport('ActivityType', { name });
    await imported.exec(sql);
    assert.equal((await imported.query('select name from public.activity_types')).rows[0].name, name);
    await imported.exec("update public.activity_types set name = 'edited after import'");
    await imported.exec(sql);
    assert.equal((await imported.query('select name from public.activity_types')).rows[0].name, 'edited after import');
    assert.equal((await imported.query('select count(*)::int as count from base44_migration.import_runs')).rows[0].count, 1);
  } finally { await imported.close(); }
});

test('failed foreign-key import rolls back projections, staging and import ledger together', async () => {
  const imported = await localDatabase();
  try {
    const sql = fixtureImport('ScheduleEntry', { employee_id: 'missing', activity: 'Teste', date: '2026-11-01', start_time: '08:00', end_time: '09:00' });
    await assert.rejects(imported.exec(sql), error => error.code === '23503');
    await imported.exec('rollback;');
    for (const table of ['public.schedule_entries', 'base44_migration.records', 'base44_migration.import_runs']) {
      assert.equal((await imported.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
    }
  } finally { await imported.close(); }
});

test('initial import refuses a nonempty destination and leaves existing data intact', async () => {
  const imported = await localDatabase();
  try {
    await imported.exec("insert into public.activity_types(id, name) values ('existing', 'Preserve existing')");
    await assert.rejects(imported.exec(fixtureImport('ActivityType', { name: 'New fixture' })), error => error.code === 'P0001');
    await imported.exec('rollback;');
    assert.deepEqual((await imported.query('select id, name from public.activity_types')).rows, [{ id: 'existing', name: 'Preserve existing' }]);
    assert.equal((await imported.query('select count(*)::int as count from base44_migration.records')).rows[0].count, 0);
  } finally { await imported.close(); }
});
