// Disposable PostgreSQL/WASM for local SQL verification only.
// The auth bootstrap is a test fixture, not a replacement for Supabase Auth.
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

export async function localDatabase({ stagingOnly = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  for (const name of files) {
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
    if (stagingOnly) break;
  }
  return db;
}
