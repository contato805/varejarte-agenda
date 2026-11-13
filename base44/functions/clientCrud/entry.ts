import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function validateEmployeeSession(base44, token, employeeId) {
  if (!token || !employeeId) return null;
  const employees = await base44.asServiceRole.entities.Employee.filter({ active: true });
  const emp = employees.find(e => e.id === employeeId);
  if (!emp || emp.session_token !== token) return null;
  if (emp.session_expires && new Date(emp.session_expires) < new Date()) return null;
  return emp;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, data, id, sessionToken, sessionEmployeeId } = body;

    // Try platform auth first, fall back to employee session
    let authorized = false;
    try {
      const user = await base44.auth.me();
      if (user) authorized = true;
    } catch {}

    if (!authorized) {
      const emp = await validateEmployeeSession(base44, sessionToken, sessionEmployeeId);
      if (!emp || emp.access_type !== 'admin') {
        return Response.json({ error: 'Não autorizado' }, { status: 401 });
      }
      authorized = true;
    }

    if (action === 'list') {
      const clients = await base44.asServiceRole.entities.Client.list();
      return Response.json({ clients });
    }

    if (action === 'listActivityTypes') {
      const types = await base44.asServiceRole.entities.ActivityType.list();
      return Response.json({ activityTypes: types });
    }

    // Clean data: remove empty strings, convert to null for optional number fields
    function cleanClientData(d) {
      const cleaned = { ...d };
      if (cleaned.monthly_contract_value === '' || cleaned.monthly_contract_value === undefined) {
        delete cleaned.monthly_contract_value;
      } else {
        cleaned.monthly_contract_value = Number(cleaned.monthly_contract_value) || 0;
      }
      if (cleaned.activity_notes === '') {
        delete cleaned.activity_notes;
      }
      // Ensure quantity fields are numbers in monthly_activities
      if (Array.isArray(cleaned.monthly_activities)) {
        cleaned.monthly_activities = cleaned.monthly_activities.map(a => ({
          ...a,
          quantity: a.quantity ? Number(a.quantity) : 0,
          duration_minutes: a.duration_minutes ? Number(a.duration_minutes) : 0,
        }));
      }
      // Same for branch monthly_activities
      if (Array.isArray(cleaned.branches)) {
        cleaned.branches = cleaned.branches.map(b => ({
          ...b,
          monthly_activities: Array.isArray(b.monthly_activities)
            ? b.monthly_activities.map(a => ({
                ...a,
                quantity: a.quantity ? Number(a.quantity) : 0,
                duration_minutes: a.duration_minutes ? Number(a.duration_minutes) : 0,
              }))
            : [],
        }));
      }
      // Ensure contact birthday fields are numbers
      if (Array.isArray(cleaned.contacts)) {
        cleaned.contacts = cleaned.contacts.map(c => ({
          ...c,
          birthday_day: c.birthday_day ? Number(c.birthday_day) : undefined,
          birthday_month: c.birthday_month ? Number(c.birthday_month) : undefined,
        }));
      }
      return cleaned;
    }

    if (action === 'create') {
      const client = await base44.asServiceRole.entities.Client.create(cleanClientData(data));
      return Response.json({ client });
    }

    if (action === 'update') {
      const client = await base44.asServiceRole.entities.Client.update(id, cleanClientData(data));
      return Response.json({ client });
    }

    if (action === 'delete') {
      // Delete pending schedule entries for this client
      const entries = await base44.asServiceRole.entities.ScheduleEntry.filter({ client_id: id });
      const pending = entries.filter(e => e.status !== 'realizado');
      for (const entry of pending) {
        await base44.asServiceRole.entities.ScheduleEntry.delete(entry.id);
      }
      await base44.asServiceRole.entities.Client.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('clientCrud error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});