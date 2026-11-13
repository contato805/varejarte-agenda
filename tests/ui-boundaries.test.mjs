import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const directory = new URL('../node_modules/.cache/varejarte-ui-tests/', import.meta.url);
let AuthenticatedApp, DataReadBoundary;
const passthrough = 'export const AuthProvider = ({children}) => children; export const useAuth = () => globalThis.__varejarteAppState;';
const stubs = new Map([
  ['@/lib/AuthContext', passthrough],
  ['./pages.config', `import React from 'react';
    const page = name => () => { globalThis.__varejarteViews.push(name); return React.createElement('p', null, name); };
    export const pagesConfig = { mainPage: 'Agenda', Layout: ({children}) => children,
      Pages: { Agenda: page('Agenda'), Dashboard: page('Dashboard'), Reports: page('Reports') } };`],
  ['@/components/ui/toaster', 'export const Toaster = () => null;'],
  ['@/components/ui/button', "import React from 'react'; export const Button = ({children, variant, ...props}) => React.createElement('button', props, children);"],
  ['@/lib/query-client', "import {QueryClient} from '@tanstack/react-query'; export const queryClientInstance = new QueryClient();"],
  ['@/pages/EmployeeLogin', "import React from 'react'; export default () => React.createElement('p', null, 'Login');"],
  ['@/pages/Settings', 'export default () => null;'],
  ['./lib/PageNotFound', 'export default () => null;'],
]);

before(async () => {
  const app = fileURLToPath(new URL('../src/App.jsx', import.meta.url));
  const boundary = fileURLToPath(new URL('../src/components/layout/DataReadBoundary.jsx', import.meta.url));
  await mkdir(directory, { recursive: true });
  await build({
    stdin: { contents: `export {AuthenticatedApp} from ${JSON.stringify(app)}; export {default as DataReadBoundary} from ${JSON.stringify(boundary)};`, resolveDir: process.cwd() },
    outfile: fileURLToPath(new URL('boundaries.mjs', directory)),
    bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
    plugins: [{ name: 'local-ui-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => stubs.has(args.path) ? { path: args.path, namespace: 'test' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: stubs.get(args.path), resolveDir: process.cwd() }));
    } }],
  });
  ({ AuthenticatedApp, DataReadBoundary } = await import(new URL('boundaries.mjs', directory).href));
});
after(async () => { await rm(directory, { recursive: true, force: true }); delete globalThis.__varejarteAppState; delete globalThis.__varejarteViews; });

async function mountApp(user, path = '/', configurationError = null) {
  globalThis.__varejarteViews = [];
  globalThis.__varejarteAppState = { user, authChecked: true, isLoadingAuth: false, configurationError };
  let root;
  await act(async () => {
    root = create(React.createElement(MemoryRouter, { initialEntries: [path], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, React.createElement(AuthenticatedApp)));
  });
  return root;
}
async function close(root) { await act(async () => root.unmount()); }

test('viewer and supervisor never mount hidden administrative tabs, including a direct admin URL', async () => {
  for (const access_type of ['viewer', 'supervisor']) {
    const root = await mountApp({ access_type }, '/Dashboard');
    try { assert.deepEqual(globalThis.__varejarteViews, ['Agenda']); }
    finally { await close(root); }
  }
});

test('administrator retains the original persistent dashboard, agenda and report tabs', async () => {
  const root = await mountApp({ access_type: 'admin' });
  try { assert.deepEqual(globalThis.__varejarteViews, ['Dashboard', 'Agenda', 'Reports']); }
  finally { await close(root); }
});

test('missing project configuration renders preparation without mounting login or data pages', async () => {
  const root = await mountApp(null, '/entrar', 'Project not configured');
  try {
    assert.deepEqual(globalThis.__varejarteViews, []);
    assert.match(JSON.stringify(root.toJSON()), /Ambiente em preparação/);
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /Login/);
  } finally { await close(root); }
});

test('failed data reads hide totals until the user resets the failed queries', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await assert.rejects(queryClient.fetchQuery({ queryKey: ['entries'], queryFn: async () => { throw new Error('Incomplete page'); } }));
  let root;
  await act(async () => { root = create(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(DataReadBoundary, null, React.createElement('p', null, 'Totals fixture')))); });
  try {
    assert.equal(root.root.findAllByProps({ role: 'alert' }).length, 1);
    assert.equal(root.root.findAllByType('div').some(node => node.props.hidden === true), true);
    await act(async () => root.root.findByType('button').props.onClick());
    assert.equal(root.root.findAllByProps({ role: 'alert' }).length, 0);
    assert.equal(root.root.findAllByType('div').some(node => node.props.hidden === true), false);
  } finally { await close(root); queryClient.clear(); }
});
