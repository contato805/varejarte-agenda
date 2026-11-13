-- Private staging for the Base44 import. This is not the application's data model.
-- Do not add base44_migration to the Data API's exposed schemas.
create schema base44_migration;
revoke all on schema base44_migration from public, anon, authenticated;

create table base44_migration.records (
  entity text not null check (entity in ('ActivityType', 'AuditLog', 'Client', 'Employee', 'ScheduleEntry')),
  legacy_id text not null check (length(btrim(legacy_id)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  imported_at timestamptz not null default now(),
  primary key (entity, legacy_id),
  constraint no_legacy_credentials check (
    not (payload ?| array['password', 'session_token', 'session_expires', 'access_token', 'refresh_token'])
  )
);

alter table base44_migration.records enable row level security;
revoke all on base44_migration.records from public, anon, authenticated;
comment on table base44_migration.records is
  'Private migration staging. Legacy IDs preserved. No browser access or imported credentials.';
