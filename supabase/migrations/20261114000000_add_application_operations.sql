-- Application identity is safe to query before transmitting login credentials.
create function public.app_identity() returns jsonb language sql immutable
set search_path = pg_catalog as $$
  select jsonb_build_object('application', 'varejarte-agenda', 'protocol_version', 1)
$$;
revoke all on function public.app_identity() from public;
grant execute on function public.app_identity() to anon, authenticated, service_role;

create function app_private.clean_number(value text) returns numeric
language plpgsql immutable set search_path = pg_catalog as $$
declare result numeric;
begin
  if value is null or value = '' then return null; end if;
  result := value::numeric;
  if result::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Valor numérico inválido' using errcode = '22023';
  end if;
  return result;
end $$;

create function app_private.clean_activities(items jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; result jsonb := '[]'; field text; quantity numeric;
begin
  if items is null then return result; end if;
  if jsonb_typeof(items) <> 'array' then raise exception 'Lista de atividades inválida' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Atividade inválida' using errcode = '22023'; end if;
    foreach field in array array['quantity', 'duration_minutes'] loop
      quantity := coalesce(app_private.clean_number(item->>field), 0);
      if quantity < 0 then raise exception 'Quantidade/duração negativa' using errcode = '22023'; end if;
      item := item || jsonb_build_object(field, quantity);
    end loop;
    result := result || jsonb_build_array(item);
  end loop;
  return result;
end $$;

create function app_private.clean_contacts(items jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; result jsonb := '[]'; field text; n numeric; maximum integer;
begin
  if items is null then return result; end if;
  if jsonb_typeof(items) <> 'array' then raise exception 'Lista de contatos inválida' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Contato inválido' using errcode = '22023'; end if;
    foreach field in array array['birthday_day', 'birthday_month'] loop
      n := app_private.clean_number(item->>field);
      maximum := case when field = 'birthday_day' then 31 else 12 end;
      if n is not null and (n <> trunc(n) or n < 1 or n > maximum) then
        raise exception 'Dia/mês de aniversário inválido' using errcode = '22023';
      end if;
      item := item || jsonb_build_object(field, n);
    end loop;
    result := result || jsonb_build_array(item);
  end loop;
  return result;
end $$;

create function app_private.normalize_client() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare branch jsonb; branches jsonb := '[]';
begin
  new.monthly_activities := app_private.clean_activities(new.monthly_activities);
  if jsonb_typeof(new.branches) <> 'array' then raise exception 'Lista de filiais inválida' using errcode = '22023'; end if;
  for branch in select value from jsonb_array_elements(new.branches) loop
    if jsonb_typeof(branch) <> 'object' then raise exception 'Filial inválida' using errcode = '22023'; end if;
    branch := branch || jsonb_build_object('active', coalesce((branch->>'active')::boolean, true),
      'monthly_activities', app_private.clean_activities(branch->'monthly_activities'));
    branches := branches || jsonb_build_array(branch);
  end loop;
  new.branches := branches;
  return new;
end $$;
create trigger normalize_client before insert or update on public.clients
for each row execute function app_private.normalize_client();

create function app_private.touch_updated_date() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin new.updated_date := timezone('UTC', now()); return new; end $$;
create trigger employees_updated before update on public.employees for each row execute function app_private.touch_updated_date();
create trigger clients_updated before update on public.clients for each row execute function app_private.touch_updated_date();
create trigger activities_updated before update on public.activity_types for each row execute function app_private.touch_updated_date();
create trigger schedules_updated before update on public.schedule_entries for each row execute function app_private.touch_updated_date();

create function public.save_client(p_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare saved public.clients; details app_private.client_details;
begin
  if (public.current_actor()->>'access_type') is distinct from 'admin' then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data) <> 'object' or p_data is null then
    raise exception 'Dados do cliente inválidos' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_data) as k(key) where key <> all(array[
    'company_name', 'active', 'branches', 'monthly_activities', 'activity_notes', 'contacts', 'monthly_contract_value'])) then
    raise exception 'Campo de cliente não permitido' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.clients(company_name, active, branches, monthly_activities, activity_notes, created_by_id)
    values (p_data->>'company_name', coalesce((p_data->>'active')::boolean, true), coalesce(p_data->'branches', '[]'),
      coalesce(p_data->'monthly_activities', '[]'), p_data->>'activity_notes', auth.uid()::text)
    returning * into saved;
  else
    select * into saved from public.clients where id = p_id and deleted_at is null for update;
    if not found then raise exception 'Cliente não encontrado' using errcode = 'P0002'; end if;
    update public.clients set
      company_name = case when p_data ? 'company_name' then p_data->>'company_name' else saved.company_name end,
      active = case when p_data ? 'active' then (p_data->>'active')::boolean else saved.active end,
      branches = case when p_data ? 'branches' then p_data->'branches' else saved.branches end,
      monthly_activities = case when p_data ? 'monthly_activities' then p_data->'monthly_activities' else saved.monthly_activities end,
      activity_notes = case when p_data ? 'activity_notes' then p_data->>'activity_notes' else saved.activity_notes end
    where id = p_id returning * into saved;
  end if;
  select * into details from app_private.client_details where client_id = saved.id;
  insert into app_private.client_details(client_id, contacts, monthly_contract_value)
  values (saved.id,
    case when p_data ? 'contacts' then app_private.clean_contacts(p_data->'contacts') else coalesce(details.contacts, '[]') end,
    case when p_data ? 'monthly_contract_value' then app_private.clean_number(p_data->>'monthly_contract_value') else details.monthly_contract_value end)
  on conflict (client_id) do update set contacts = excluded.contacts, monthly_contract_value = excluded.monthly_contract_value
  returning * into details;
  return to_jsonb(saved) || jsonb_build_object('contacts', details.contacts, 'monthly_contract_value', details.monthly_contract_value);
end $$;
revoke all on function public.save_client(text, jsonb) from public, anon;
grant execute on function public.save_client(text, jsonb) to authenticated;

create function public.remove_client(p_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (public.current_actor()->>'access_type') is distinct from 'admin' then raise exception 'Acesso restrito à administração' using errcode = '42501'; end if;
  perform 1 from public.clients where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Cliente não encontrado' using errcode = 'P0002'; end if;
  update public.schedule_entries set deleted_at = now() where client_id = p_id and status <> 'realizado' and deleted_at is null;
  update public.clients set deleted_at = now(), active = false where id = p_id;
  return jsonb_build_object('success', true);
end $$;
revoke all on function public.remove_client(text) from public, anon;
grant execute on function public.remove_client(text) to authenticated;

-- Preserve historical branch labels even when a branch is disabled or removed.
create function app_private.sync_client_name() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  update public.schedule_entries s set client_name = new.company_name || case
    when left(s.client_name, length(old.company_name) + 3) in (old.company_name || ' — ', old.company_name || ' - ')
      then substring(s.client_name from length(old.company_name) + 1)
    else '' end
    where s.client_id = new.id and s.deleted_at is null;
  return new;
end $$;
create trigger sync_client_name after update of company_name on public.clients
for each row when (old.company_name is distinct from new.company_name)
execute function app_private.sync_client_name();

create function public.remove_agenda_record(p_entity text, p_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (public.current_actor()->>'access_type') is distinct from 'admin' then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if p_entity = 'ScheduleEntry' then
    update public.schedule_entries set deleted_at = now() where id = p_id and deleted_at is null;
  elsif p_entity = 'ActivityType' then
    update public.activity_types set deleted_at = now() where id = p_id and deleted_at is null;
  else
    raise exception 'Tipo de registro inválido' using errcode = '22023';
  end if;
  if not found then raise exception 'Registro não encontrado' using errcode = 'P0002'; end if;
  return jsonb_build_object('success', true);
end $$;
revoke all on function public.remove_agenda_record(text, text) from public, anon;
grant execute on function public.remove_agenda_record(text, text) to authenticated;

revoke insert on public.audit_logs from authenticated;
create function public.append_audit_log(p_action text, p_category text, p_details text default '') returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare actor jsonb := public.current_actor(); saved public.audit_logs;
begin
  if (actor->>'access_type') is distinct from 'admin' then raise exception 'Acesso restrito à administração' using errcode = '42501'; end if;
  insert into public.audit_logs(action, category, details, user_name, created_by_id)
    values (p_action, p_category, p_details, actor->>'name', auth.uid()::text) returning * into saved;
  return to_jsonb(saved);
end $$;
revoke all on function public.append_audit_log(text, text, text) from public, anon;
grant execute on function public.append_audit_log(text, text, text) to authenticated;

create function public.export_backup() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  if (public.current_actor()->>'access_type') is distinct from 'admin' then raise exception 'Acesso restrito à administração' using errcode = '42501'; end if;
  return jsonb_build_object(
    'Employee', coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('monthly_salary', f.monthly_salary) order by e.id)
      from public.employees e left join app_private.employee_finances f on f.employee_id = e.id), '[]'),
    'Client', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('contacts', coalesce(d.contacts, '[]'), 'monthly_contract_value', d.monthly_contract_value) order by c.id)
      from public.clients c left join app_private.client_details d on d.client_id = c.id), '[]'),
    'ActivityType', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.activity_types t), '[]'),
    'ScheduleEntry', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.schedule_entries s), '[]'),
    'AuditLog', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a), '[]')
  );
end $$;
revoke all on function public.export_backup() from public, anon;
grant execute on function public.export_backup() to authenticated;

revoke all on function app_private.clean_number(text), app_private.clean_activities(jsonb),
  app_private.clean_contacts(jsonb), app_private.normalize_client(), app_private.touch_updated_date(),
  app_private.sync_client_name() from public, anon, authenticated;
