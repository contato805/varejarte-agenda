import { loginAddress } from './login-address.js';

const TABLES = { ScheduleEntry: 'schedule_entries', ActivityType: 'activity_types', AuditLog: 'audit_logs' };
const READERS = { Employee: 'employee_records', Client: 'client_records' };
const WRITABLE = {
  ScheduleEntry: ['employee_id', 'employee_name', 'employee_color', 'client_id', 'client_name', 'activity', 'date', 'start_time', 'end_time', 'notes', 'status'],
  ActivityType: ['name'],
};
const PAGE_SIZE = 500;
const MAX_ROWS = 100000;
const pick = (data, fields) => Object.fromEntries(Object.entries(data || {}).filter(([key]) => fields.includes(key)));

function throwError(error) { if (error) throw Object.assign(new Error(error.message || 'Não foi possível concluir a operação.'), { code: error.code, status: error.status }); }
function validOffset(value) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Paginação inválida.'); return value; }
function sortRows(rows, sort) {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return rows.sort((a, b) => {
    const x = a[field], y = b[field];
    const order = x === y ? 0 : x == null ? -1 : y == null ? 1 : x < y ? -1 : 1;
    return order ? order * (descending ? -1 : 1) : String(a.id).localeCompare(String(b.id));
  });
}
function matches(row, filters) {
  return Object.entries(filters).every(([key, value]) => {
    if (value && typeof value === 'object') return Object.entries(value).every(([op, expected]) => {
      if (op === '$gte') return row[key] >= expected;
      if (op === '$lte') return row[key] <= expected;
      if (op === '$in') return expected.includes(row[key]);
      if (op === '$ne') return row[key] !== expected;
      throw new Error('Filtro não suportado.');
    });
    return row[key] === value;
  });
}

export function createAgendaClient(supabase) {
  let identityPromise;
  async function ready() {
    identityPromise ??= (async () => {
      const { data, error } = await supabase.rpc('app_identity');
      throwError(error);
      if (data?.application !== 'varejarte-agenda' || data?.protocol_version !== 1) throw new Error('Este servidor não pertence ao Varejarte Agenda.');
    })().catch(error => { identityPromise = null; throw error; });
    await identityPromise;
  }
  async function rpc(name, args = {}) {
    await ready();
    const { data, error } = await supabase.rpc(name, args);
    throwError(error);
    return data;
  }
  async function actor() {
    await ready();
    const { data, error } = await supabase.auth.getUser();
    if (error?.name === 'AuthSessionMissingError' || error?.status === 401) return null;
    throwError(error);
    if (!data?.user) return null;
    const current = await rpc('current_actor');
    return current ? { ...current, role: current.access_type === 'admin' ? 'admin' : 'user', full_name: current.name } : null;
  }
  async function edge(name, body) {
    await ready();
    const { data, error } = await supabase.functions.invoke(name, { body });
    throwError(error);
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function pages(makeQuery, skip = 0, limit = Infinity) {
    const rows = [];
    let total;
    const ids = new Set();
    while (rows.length < limit) {
      const size = Math.min(PAGE_SIZE, limit - rows.length);
      const offset = skip + rows.length;
      const { data, error, count } = await makeQuery().range(offset, offset + size - 1);
      throwError(error);
      if (!Array.isArray(data) || !Number.isSafeInteger(count)) throw new Error('O servidor não informou a quantidade completa de registros.');
      if (total !== undefined && total !== count) throw new Error('Os dados mudaram durante a leitura. Atualize a página.');
      total = count;
      for (const row of data) {
        if (ids.has(row.id)) throw new Error('A leitura retornou registros repetidos. Atualize a página.');
        ids.add(row.id);
        rows.push(row);
      }
      if (skip + rows.length >= count || rows.length >= limit) break;
      if (!data.length) throw new Error('A leitura terminou antes de carregar todos os registros.');
      if (rows.length >= MAX_ROWS) throw new Error('O volume ultrapassou o limite de leitura segura. Restrinja o período.');
    }
    return rows;
  }
  async function read(entity, filters = {}, sort = '-created_date', limit, skip = 0) {
    await ready();
    validOffset(skip);
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) throw new Error('Limite inválido.');
    if (limit === 0) return [];
    if (!/^-?[a-z_]+$/.test(sort)) throw new Error('Ordenação inválida.');
    if (READERS[entity]) {
      const rows = await pages(() => supabase.rpc(READERS[entity], {}, { count: 'exact' }));
      return sortRows(rows.filter(row => matches(row, filters)), sort).slice(skip, limit === undefined ? undefined : skip + limit);
    }
    return pages(() => {
      let query = supabase.from(TABLES[entity]).select('*', { count: 'exact' });
      if (entity !== 'AuditLog') query = query.is('deleted_at', null);
      for (const [field, value] of Object.entries(filters)) {
        if (!/^[a-z_]+$/.test(field)) throw new Error('Campo de filtro inválido.');
        if (value && typeof value === 'object') {
          for (const [operation, expected] of Object.entries(value)) {
            const method = { $gte: 'gte', $lte: 'lte', $in: 'in', $ne: 'neq' }[operation];
            if (!method) throw new Error('Filtro não suportado.');
            query = query[method](field, expected);
          }
        } else query = value === null ? query.is(field, null) : query.eq(field, value);
      }
      const descending = sort.startsWith('-');
      const field = descending ? sort.slice(1) : sort;
      query = query.order(field, { ascending: !descending });
      if (field !== 'id') query = query.order('id', { ascending: true });
      return query;
    }, skip, limit);
  }
  const entities = {};
  for (const entity of [...Object.keys(TABLES), ...Object.keys(READERS)]) {
    entities[entity] = {
      list: (sort, limit, skip) => read(entity, {}, sort, limit, skip),
      filter: (filters, sort, limit, skip) => read(entity, filters, sort, limit, skip),
      async create(data) {
        await ready();
        if (entity === 'Employee') return edge('employee-access', { action: 'create', data });
        if (entity === 'Client') return rpc('save_client', { p_id: null, p_data: data });
        if (entity === 'AuditLog') return rpc('append_audit_log', { p_action: data.action, p_category: data.category, p_details: data.details || '' });
        const result = await supabase.from(TABLES[entity]).insert(pick(data, WRITABLE[entity])).select().single();
        throwError(result.error);
        return result.data;
      },
      async update(id, data) {
        await ready();
        if (entity === 'Employee') return edge('employee-access', { action: 'update', id, data });
        if (entity === 'Client') return rpc('save_client', { p_id: id, p_data: data });
        if (!WRITABLE[entity]) throw new Error('Este registro não pode ser editado.');
        const result = await supabase.from(TABLES[entity]).update(pick(data, WRITABLE[entity])).eq('id', id).is('deleted_at', null).select().single();
        throwError(result.error);
        return result.data;
      },
      async delete(id) {
        await ready();
        if (entity === 'Employee') return edge('employee-access', { action: 'delete', id });
        if (entity === 'Client') return rpc('remove_client', { p_id: id });
        if (!WRITABLE[entity]) throw new Error('Este registro não pode ser removido.');
        return rpc('remove_agenda_record', { p_entity: entity, p_id: id });
      },
    };
  }
  return {
    ready, entities,
    auth: {
      me: actor,
      async signIn(login, password) {
        await ready(); // Verify app identity before transmitting credentials.
        const { error } = await supabase.auth.signInWithPassword({ email: await loginAddress(login), password });
        throwError(error);
        const current = await actor();
        if (!current) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('Seu acesso ao Varejarte ainda não foi liberado.');
        }
        return current;
      },
      async logout() { const { error } = await supabase.auth.signOut({ scope: 'local' }); throwError(error); },
      onChange: callback => supabase.auth.onAuthStateChange(callback),
    },
    functions: {
      async invoke(name, body = {}) {
        if (name === 'clientCrud') {
          if ((await actor())?.access_type !== 'admin') throw new Error('Acesso restrito à administração.');
          if (body.action === 'list') return { data: { clients: await entities.Client.list() } };
          if (body.action === 'listActivityTypes') return { data: { activityTypes: await entities.ActivityType.list() } };
          if (body.action === 'create') return { data: { client: await entities.Client.create(body.data) } };
          if (body.action === 'update') return { data: { client: await entities.Client.update(body.id, body.data) } };
          if (body.action === 'delete') return { data: await entities.Client.delete(body.id) };
          throw new Error('Operação de cliente inválida.');
        }
        if (name === 'generateFullBackupMd') {
          const snapshot = await rpc('export_backup');
          const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Manaus' }).format(new Date());
          const sections = Object.entries(snapshot).map(([entity, rows]) => `## ${entity} (${rows.length})\n\n\`\`\`json\n${JSON.stringify(rows, null, 2)}\n\`\`\``);
          return { data: { date, markdown: `# Backup Varejarte Agenda — ${date}\n\n${sections.join('\n\n')}\n` } };
        }
        if (name === 'importSchedule') return { data: await edge('import-schedule', body) };
        throw new Error(`Operação indisponível neste ambiente: ${name}`);
      },
    },
  };
}
