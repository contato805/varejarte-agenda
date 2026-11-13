-- Dedicated Varejarte project only. No connection to the Base44 application.
-- Passwords and session tokens are deliberately absent from the data model.
-- Base44 CSV metadata timestamps have no offset: preserve their literal wall time.
-- Calendar dates/times are separate fields; no host-timezone conversion is inferred.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.employees (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(btrim(name)) > 0),
  color text not null,
  role text,
  active boolean not null default true,
  access_type text not null default 'viewer' check (access_type in ('admin', 'supervisor', 'viewer')),
  login text,
  birthday_day integer check (birthday_day between 1 and 31),
  birthday_month integer check (birthday_month between 1 and 12),
  created_date timestamp without time zone not null default timezone('UTC', now()),
  updated_date timestamp without time zone not null default timezone('UTC', now()),
  created_by_id text,
  created_by text,
  is_sample boolean not null default false,
  deleted_at timestamptz
);
create unique index employees_login_unique on public.employees (lower(login))
  where login is not null and login <> '' and deleted_at is null;

create table public.clients (
  id text primary key default gen_random_uuid()::text,
  company_name text not null check (length(btrim(company_name)) > 0),
  active boolean not null default true,
  branches jsonb not null default '[]' check (jsonb_typeof(branches) = 'array'),
  monthly_activities jsonb not null default '[]' check (jsonb_typeof(monthly_activities) = 'array'),
  activity_notes text,
  created_date timestamp without time zone not null default timezone('UTC', now()),
  updated_date timestamp without time zone not null default timezone('UTC', now()),
  created_by_id text,
  created_by text,
  is_sample boolean not null default false,
  deleted_at timestamptz
);

create table public.activity_types (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(btrim(name)) > 0),
  created_date timestamp without time zone not null default timezone('UTC', now()),
  updated_date timestamp without time zone not null default timezone('UTC', now()),
  created_by_id text,
  created_by text,
  is_sample boolean not null default false,
  deleted_at timestamptz
);

create table public.schedule_entries (
  id text primary key default gen_random_uuid()::text,
  employee_id text not null references public.employees(id) on delete restrict,
  employee_name text,
  employee_color text,
  client_id text references public.clients(id) on delete restrict,
  client_name text,
  activity text not null check (length(btrim(activity)) > 0),
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notes text,
  status text not null default 'agendado' check (status in ('agendado', 'realizado', 'cancelado')),
  created_date timestamp without time zone not null default timezone('UTC', now()),
  updated_date timestamp without time zone not null default timezone('UTC', now()),
  created_by_id text,
  created_by text,
  is_sample boolean not null default false,
  deleted_at timestamptz
);
-- An end time before the start is allowed: the original app contains midnight/end-of-day entries.
create index schedule_entries_date_idx on public.schedule_entries(date, id) where deleted_at is null;
create index schedule_entries_employee_date_idx on public.schedule_entries(employee_id, date) where deleted_at is null;
create index schedule_entries_client_date_idx on public.schedule_entries(client_id, date) where deleted_at is null;

create table public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  action text not null,
  category text not null,
  user_name text not null,
  details text,
  created_date timestamp without time zone not null default timezone('UTC', now()),
  updated_date timestamp without time zone not null default timezone('UTC', now()),
  created_by_id text,
  created_by text,
  is_sample boolean not null default false
);
create index audit_logs_created_date_idx on public.audit_logs(created_date desc, id);

-- Restricted attributes are never present in browser-readable tables.
create table app_private.employee_finances (
  employee_id text primary key references public.employees(id) on delete restrict,
  monthly_salary numeric
);
create table app_private.client_details (
  client_id text primary key references public.clients(id) on delete restrict,
  contacts jsonb not null default '[]' check (jsonb_typeof(contacts) = 'array'),
  monthly_contract_value numeric
);
create table app_private.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id text unique references public.employees(id) on delete restrict,
  is_owner boolean not null default false,
  display_name text not null default 'Administrador',
  enabled boolean not null default true,
  check ((is_owner and employee_id is null) or (not is_owner and employee_id is not null))
);
create table base44_migration.import_runs (
  snapshot_sha256 text primary key,
  manifest jsonb not null,
  completed_at timestamptz not null default now()
);

-- The server-owned identity mapping is the only source of application roles.
-- No user_metadata role or browser session field is trusted.
create function public.current_actor() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'auth_user_id', a.user_id,
    'id', e.id,
    'name', case when a.is_owner then a.display_name else e.name end,
    'color', e.color,
    'access_type', case when a.is_owner then 'admin' else e.access_type end
  )
  from app_private.user_access a
  left join public.employees e on e.id = a.employee_id
  where a.user_id = auth.uid() and a.enabled
    and (a.is_owner or (e.active and e.deleted_at is null))
$$;
revoke all on function public.current_actor() from public, anon;
grant execute on function public.current_actor() to authenticated, service_role;

alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.activity_types enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table app_private.user_access enable row level security;
alter table app_private.employee_finances enable row level security;
alter table app_private.client_details enable row level security;
alter table base44_migration.import_runs enable row level security;

revoke all on public.employees, public.clients, public.activity_types,
  public.schedule_entries, public.audit_logs from public, anon, authenticated;
grant select, insert, update on public.employees, public.clients, public.activity_types,
  public.schedule_entries to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant all on public.employees, public.clients, public.activity_types,
  public.schedule_entries, public.audit_logs to service_role;
revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all tables in schema base44_migration from public, anon, authenticated;
grant usage on schema app_private, base44_migration to service_role;
grant all on all tables in schema app_private to service_role;
grant all on all tables in schema base44_migration to service_role;

create policy employees_read on public.employees for select to authenticated using (
  deleted_at is null and (
    (select public.current_actor()->>'access_type') in ('admin', 'supervisor')
    or id = (select public.current_actor()->>'id')
  )
);
create policy employees_insert on public.employees for insert to authenticated
  with check ((select public.current_actor()->>'access_type') = 'admin');
create policy employees_update on public.employees for update to authenticated
  using ((select public.current_actor()->>'access_type') = 'admin')
  with check ((select public.current_actor()->>'access_type') = 'admin');

create policy clients_read on public.clients for select to authenticated
  using (deleted_at is null and (
    (select public.current_actor()->>'access_type') in ('admin', 'supervisor')
    or exists(select 1 from public.schedule_entries s where s.client_id = clients.id
      and s.employee_id = (select public.current_actor()->>'id') and s.deleted_at is null)
  ));
create policy clients_insert on public.clients for insert to authenticated
  with check ((select public.current_actor()->>'access_type') = 'admin');
create policy clients_update on public.clients for update to authenticated
  using ((select public.current_actor()->>'access_type') = 'admin')
  with check ((select public.current_actor()->>'access_type') = 'admin');

create policy activity_types_read on public.activity_types for select to authenticated
  using (deleted_at is null and (select public.current_actor()) is not null);
create policy activity_types_insert on public.activity_types for insert to authenticated
  with check ((select public.current_actor()->>'access_type') = 'admin');
create policy activity_types_update on public.activity_types for update to authenticated
  using ((select public.current_actor()->>'access_type') = 'admin')
  with check ((select public.current_actor()->>'access_type') = 'admin');

create policy schedule_entries_read on public.schedule_entries for select to authenticated using (
  deleted_at is null and (
    (select public.current_actor()->>'access_type') in ('admin', 'supervisor')
    or employee_id = (select public.current_actor()->>'id')
  )
);
create policy schedule_entries_insert on public.schedule_entries for insert to authenticated
  with check ((select public.current_actor()->>'access_type') = 'admin');
create policy schedule_entries_update on public.schedule_entries for update to authenticated
  using ((select public.current_actor()->>'access_type') = 'admin')
  with check ((select public.current_actor()->>'access_type') = 'admin');
create policy audit_logs_read on public.audit_logs for select to authenticated
  using ((select public.current_actor()->>'access_type') = 'admin');
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check ((select public.current_actor()->>'access_type') = 'admin');

-- These readers enrich the safe public rows with administrative data only for admins.
create function public.employee_records() returns setof jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor jsonb := public.current_actor();
begin
  if actor is null then raise exception 'Acesso não autorizado' using errcode = '42501'; end if;
  return query select to_jsonb(e) || jsonb_build_object('monthly_salary',
      case when actor->>'access_type' = 'admin' then f.monthly_salary else null end)
    from public.employees e left join app_private.employee_finances f on f.employee_id = e.id
    where e.deleted_at is null and
      (actor->>'access_type' in ('admin', 'supervisor') or e.id = actor->>'id')
    order by e.name, e.id;
end $$;
create function public.client_records() returns setof jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor jsonb := public.current_actor();
begin
  if actor is null then raise exception 'Acesso não autorizado' using errcode = '42501'; end if;
  return query select to_jsonb(c) || jsonb_build_object(
      'contacts', case when actor->>'access_type' = 'admin' then coalesce(d.contacts, '[]'::jsonb) else '[]'::jsonb end,
      'monthly_contract_value', case when actor->>'access_type' = 'admin' then d.monthly_contract_value else null end)
    from public.clients c left join app_private.client_details d on d.client_id = c.id
    where c.deleted_at is null and (
      actor->>'access_type' in ('admin', 'supervisor')
      or exists(select 1 from public.schedule_entries s where s.client_id = c.id
        and s.employee_id = actor->>'id' and s.deleted_at is null)
    ) order by c.company_name, c.id;
end $$;
revoke all on function public.employee_records(), public.client_records() from public, anon;
grant execute on function public.employee_records(), public.client_records() to authenticated, service_role;
