import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let AuthProvider, useAuth, observed, listener;
let currentActor = null;
let me = async () => currentActor;
const directory = new URL('../node_modules/.cache/varejarte-auth-tests/', import.meta.url);
const admin = { auth_user_id: 'fixture-user', id: 'fixture-employee', access_type: 'admin', name: 'Administrador' };
const storage = new Map();

before(async () => {
  globalThis.window = new EventTarget();
  globalThis.sessionStorage = { removeItem: key => storage.delete(key) };
  globalThis.__varejarteAuthFixture = { auth: {
    me: () => me(),
    signIn: async () => currentActor,
    logout: async () => { currentActor = null; listener('SIGNED_OUT'); },
    onChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() { listener = null; } } } }; },
  } };
  await mkdir(directory, { recursive: true });
  await build({
    entryPoints: [fileURLToPath(new URL('../src/lib/AuthContext.jsx', import.meta.url))],
    outfile: fileURLToPath(new URL('provider.mjs', directory)),
    bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
    plugins: [{ name: 'local-auth-boundary', setup(builder) {
      builder.onResolve({ filter: /^@\/api\/client$/ }, () => ({ path: 'auth-fixture', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const api = globalThis.__varejarteAuthFixture; export const configurationError = null;' }));
    } }],
  });
  ({ AuthProvider, useAuth } = await import(new URL('provider.mjs', directory).href));
});
after(async () => { await rm(directory, { recursive: true, force: true }); delete globalThis.__varejarteAuthFixture; });

function Probe() { observed = useAuth(); return null; }
async function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let root;
  await act(async () => { root = create(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(AuthProvider, null, React.createElement(Probe)))); });
  return { root, queryClient };
}
async function close(root) { await act(async () => root.unmount()); }

test('a forged legacy browser administrator session grants no access', async () => {
  currentActor = null;
  storage.set('employeeSession', JSON.stringify({ id: 'forged', access_type: 'admin', token: 'forged' }));
  const { root } = await mount();
  try {
    assert.equal(observed.authChecked, true);
    assert.equal(observed.isAuthenticated, false);
    assert.equal(observed.user, null);
    assert.equal(storage.has('employeeSession'), false);
  } finally { await close(root); }
});

test('server role changes clear administrative query data before exposing the new actor', async () => {
  currentActor = admin;
  const { root, queryClient } = await mount();
  try {
    queryClient.setQueryData(['employees'], [{ monthly_salary: 'private-fixture' }]);
    currentActor = { ...admin, access_type: 'viewer' };
    await act(async () => observed.refresh());
    assert.equal(observed.user.access_type, 'viewer');
    assert.equal(queryClient.getQueryData(['employees']), undefined);
    assert.equal(queryClient.getQueryCache().getAll().length, 0);
  } finally { await close(root); }
});

test('an earlier pending actor response cannot restore access or cached data after logout', async () => {
  currentActor = admin;
  const { root, queryClient } = await mount();
  try {
    queryClient.setQueryData(['clients'], [{ monthly_contract_value: 'private-fixture' }]);
    let resolve;
    me = () => new Promise(done => { resolve = done; });
    let pending;
    await act(async () => { pending = observed.refresh(); });
    await act(async () => observed.logout());
    await act(async () => { resolve(admin); await pending; });
    assert.equal(observed.user, null);
    assert.equal(observed.isAuthenticated, false);
    assert.equal(queryClient.getQueryCache().getAll().length, 0);
  } finally { me = async () => currentActor; await close(root); }
});

test('a failed access check removes the current actor instead of trusting the previous session', async () => {
  currentActor = admin;
  const { root } = await mount();
  try {
    me = async () => { throw new Error('Servidor indisponível'); };
    await act(async () => observed.refresh());
    assert.equal(observed.user, null);
    assert.equal(observed.isAuthenticated, false);
    assert.equal(observed.authError, 'Servidor indisponível');
  } finally { me = async () => currentActor; await close(root); }
});

test('a delayed login result cannot restore access after the user has signed out', async () => {
  currentActor = admin;
  const { root } = await mount();
  const original = globalThis.__varejarteAuthFixture.auth.signIn;
  try {
    let resolve;
    globalThis.__varejarteAuthFixture.auth.signIn = () => new Promise(done => { resolve = done; });
    let pending;
    await act(async () => { pending = observed.signIn('teste', 'fixture-password'); });
    await act(async () => observed.logout());
    await act(async () => {
      const rejected = assert.rejects(pending, /entrada foi cancelada/);
      resolve(admin);
      await rejected;
    });
    assert.equal(observed.user, null);
    assert.equal(observed.isAuthenticated, false);
  } finally { globalThis.__varejarteAuthFixture.auth.signIn = original; await close(root); }
});
