import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createAgendaClient } from '../src/api/agenda-client.js';
import { resolveConfig } from '../src/api/config.js';
import { loginAddress } from '../src/api/login-address.js';

const ref = 'abcdefghijklmnopqrst';
const env = { VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_PROJECT_REF: ref, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
const admin = { auth_user_id: 'fixture-auth', id: 'fixture-employee', name: 'Administrador teste', access_type: 'admin' };

// Use the actual Supabase/PostgREST builders with a fully local HTTP boundary.
// No login, query or mutation in this suite reaches a real service.
function fixture({ rows = [], cap = 500, identity = true, actor = admin, page, handle } = {}) {
  const calls = [];
  const signedIn = [];
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input);
      const call = { url, method: options.method, headers: new Headers(options.headers), body: options.body ? JSON.parse(options.body) : null };
      calls.push(call);
      const name = url.pathname.split('/').pop();
      let data, total;
      if (name === 'app_identity') data = { application: identity ? 'varejarte-agenda' : 'another-app', protocol_version: 1 };
      else if (name === 'current_actor') data = actor;
      else if (handle && (data = handle(call)) !== undefined) { /* explicit local endpoint */ }
      else {
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Math.min(Number(url.searchParams.get('limit') || 500), cap);
        const result = page ? page({ offset, limit, calls }) : { data: rows.slice(offset, offset + limit), total: rows.length };
        data = result.data; total = result.total;
      }
      const headers = { 'Content-Type': 'application/json' };
      if (total !== undefined) headers['Content-Range'] = `0-${Math.max(0, data.length - 1)}/${total}`;
      return new Response(JSON.stringify(data), { status: 200, headers });
    } },
  });
  supabase.auth.getUser = async () => ({ data: { user: { id: admin.auth_user_id } }, error: null });
  supabase.auth.signInWithPassword = async credentials => { signedIn.push(credentials); return { error: null }; };
  supabase.auth.signOut = async options => { calls.push({ logout: options }); return { error: null }; };
  return { api: createAgendaClient(supabase), supabase, calls, signedIn };
}

test('configuration accepts only the explicit public project configuration', () => {
  assert.equal(resolveConfig(env).storageKey, `varejarte:${ref}:auth`);
  assert.throws(() => resolveConfig({}), /não foi configurado/);
  assert.throws(() => resolveConfig({ ...env, VITE_SUPABASE_PROJECT_REF: 'zzzzzzzzzzzzzzzzzzzz' }), /não corresponde/);
  assert.throws(() => resolveConfig({ ...env, VITE_SUPABASE_URL: 'https://other.example.com' }), /não corresponde/);
  for (const key of ['sb_secret_fixture', `eyJx.${Buffer.from('{"role":"service_role"}').toString('base64url')}.fixture`]) {
    assert.throws(() => resolveConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }), /chave pública/);
  }
});

test('username addresses are normalized deterministically without exposing the username', async () => {
  const address = await loginAddress('  Usuário.Teste  ');
  assert.equal(address, await loginAddress('usuário.teste'));
  assert.match(address, /^[a-f0-9]{64}@login\.varejarte\.invalid$/);
  assert.equal(await loginAddress('  Pessoa@Example.com '), 'pessoa@example.com');
  await assert.rejects(loginAddress(' '), /Informe seu login/);
});

test('wrong server identity rejects login before any password is transmitted', async () => {
  const { api, signedIn } = fixture({ identity: false });
  await assert.rejects(api.auth.signIn('teste', 'fixture-password'), /não pertence/);
  assert.deepEqual(signedIn, []);
});

test('login requires a server-owned actor and locally signs out an unmapped account', async () => {
  const { api, signedIn, calls } = fixture({ actor: null });
  await assert.rejects(api.auth.signIn('teste', 'fixture-password'), /não foi liberado/);
  assert.equal(signedIn.length, 1);
  assert.deepEqual(calls.at(-1), { logout: { scope: 'local' } });
});

test('reads load every row beyond the API cap, with stable ordering and explicit count', async () => {
  const rows = Array.from({ length: 1253 }, (_, id) => ({ id: String(id), date: '2026-11-01' }));
  const { api, calls } = fixture({ rows, cap: 100 });
  assert.deepEqual(await api.entities.ScheduleEntry.list('-date'), rows);
  const pages = calls.filter(call => call.url?.pathname.endsWith('/schedule_entries'));
  assert.equal(pages.length, 13);
  assert.equal(pages[1].url.searchParams.get('offset'), '100');
  assert.equal(pages[0].url.searchParams.get('order'), 'date.desc,id.asc');
  assert.match(pages[0].headers.get('prefer'), /count=exact/);
  assert.equal(pages[0].url.searchParams.get('deleted_at'), 'is.null');
});

test('explicit limit and skip remain correct even when the server returns smaller pages', async () => {
  const rows = Array.from({ length: 1100 }, (_, id) => ({ id: String(id) }));
  const { api } = fixture({ rows, cap: 80 });
  assert.deepEqual(await api.entities.ScheduleEntry.list('id', 230, 650), rows.slice(650, 880));
  assert.deepEqual(await api.entities.ScheduleEntry.list('id', 0), []);
  await assert.rejects(api.entities.ScheduleEntry.list('id', -1), /Limite inválido/);
});

test('incomplete, changing or repeated page results fail instead of silently truncating totals', async () => {
  const cases = [
    { page: () => ({ data: [], total: 100 }), message: /antes de carregar/ },
    { page: () => ({ data: [], total: undefined }), message: /quantidade completa/ },
    { page: ({ offset }) => ({ data: [{ id: String(offset) }], total: offset ? 3 : 2 }), message: /dados mudaram/ },
    { page: () => ({ data: [{ id: 'repeated' }], total: 2 }), message: /repetidos/ },
  ];
  for (const { page, message } of cases) await assert.rejects(fixture({ page }).api.entities.ScheduleEntry.list(), message);
});

test('private-aware employee/client RPC readers also paginate before filtering and sorting', async () => {
  const rows = Array.from({ length: 1103 }, (_, id) => ({ id: String(id), name: `Pessoa ${id}`, active: id % 2 === 0 }));
  const { api, calls } = fixture({ rows, cap: 70 });
  const result = await api.entities.Employee.filter({ active: true }, 'name', 15, 5);
  const expected = rows.filter(row => row.active).sort((a, b) => a.name < b.name ? -1 : 1).slice(5, 20);
  assert.deepEqual(result, expected);
  assert.equal(calls.filter(call => call.url?.pathname.endsWith('/rpc/employee_records')).length, 16);
  assert.equal(calls.some(call => call.url?.pathname.endsWith('/employees')), false);
});

test('schedule writes whitelist fields and deletion uses the authorized server operation', async () => {
  const { api, calls } = fixture({ handle: call => {
    if (call.method === 'POST' && call.url.pathname.endsWith('/schedule_entries')) return { ...call.body, id: 'new-fixture' };
    if (call.url.pathname.endsWith('/remove_agenda_record')) return { success: true };
  } });
  await api.entities.ScheduleEntry.create({ id: 'forged', activity: 'Teste', created_by_id: 'forged', password: 'never-store', employee_id: 'e1' });
  assert.deepEqual(calls.find(call => call.url?.pathname.endsWith('/schedule_entries')).body, { activity: 'Teste', employee_id: 'e1' });
  assert.deepEqual(await api.entities.ScheduleEntry.delete('s1'), { success: true });
  assert.deepEqual(calls.at(-1).body, { p_entity: 'ScheduleEntry', p_id: 's1' });
});

test('employee credentials go only to the dedicated access function, never a table or audit RPC', async () => {
  const { api, calls } = fixture({ handle: call => call.url.pathname.endsWith('/employee-access') ? { id: 'employee' } : undefined });
  await api.entities.Employee.create({ name: 'Teste', login: 'teste', password: 'fixture-password' });
  const writes = calls.filter(call => call.method === 'POST' && !call.url.pathname.endsWith('/app_identity'));
  assert.equal(writes.length, 1);
  assert.match(writes[0].url.pathname, /functions\/v1\/employee-access$/);
  assert.equal(writes[0].body.data.password, 'fixture-password');
});

test('audit ignores caller identity; unsupported operations have no legacy fallback', async () => {
  const { api, calls } = fixture({ handle: call => call.url.pathname.endsWith('/append_audit_log') ? { id: 'audit' } : undefined });
  await api.entities.AuditLog.create({ action: 'Teste', category: 'cliente', user_name: 'Impostor', token: 'forged' });
  assert.deepEqual(calls.at(-1).body, { p_action: 'Teste', p_category: 'cliente', p_details: '' });
  const before = calls.length;
  await assert.rejects(api.functions.invoke('validateSession', { token: 'forged' }), /indisponível/);
  assert.equal(calls.length, before);
});

test('server-confirmed supervisor cannot use administrative client operations', async () => {
  const { api, calls } = fixture({ actor: { ...admin, access_type: 'supervisor' } });
  await assert.rejects(api.functions.invoke('clientCrud', { action: 'create', data: { company_name: 'Teste' } }), /restrito/);
  assert.equal(calls.some(call => call.url?.pathname.endsWith('/save_client')), false);
});
