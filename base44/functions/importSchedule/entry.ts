import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    // Fetch the file
    const fileResp = await fetch(file_url);
    const arrayBuffer = await fileResp.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Load employees and clients
    const employees = await base44.asServiceRole.entities.Employee.filter({});
    const clients = await base44.asServiceRole.entities.Client.filter({});

    // Build lookup maps (case-insensitive for employees)
    const empMap = {};
    for (const e of employees) {
      empMap[e.name.toUpperCase()] = e;
    }

    const clientMap = {};
    for (const c of clients) {
      clientMap[c.company_name] = c;
    }

    // Parse rows into schedule entries
    const entries = [];
    let skipped = 0;

    for (const row of rows) {
      const rawDate = row['Data'];
      const startTime = row['Hora Início'];
      const endTime = row['Hora Fim'];
      const responsible = (row['Responsável'] || '').trim().toUpperCase();
      const activity = (row['Atividade'] || '').trim();
      const clientName = (row['Cliente / Local'] || '').trim();

      // Parse date DD/MM/YYYY to YYYY-MM-DD
      let dateStr = '';
      if (typeof rawDate === 'string' && rawDate.includes('/')) {
        const parts = rawDate.split('/');
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }

      const emp = empMap[responsible];
      const client = clientMap[clientName] || clientMap['—'] || null;

      if (!emp || !dateStr) {
        skipped++;
        continue;
      }

      // If client not found but clientName is "—" or empty, skip client
      let clientId = '';
      let clientNameResolved = clientName;
      if (client) {
        clientId = client.id;
        clientNameResolved = client.company_name;
      } else if (clientName === '—' || clientName === '-' || !clientName) {
        clientId = '';
        clientNameResolved = clientName || '—';
      } else {
        // Client not found - skip
        skipped++;
        continue;
      }

      entries.push({
        employee_id: emp.id,
        employee_name: emp.name,
        employee_color: emp.color,
        client_id: clientId,
        client_name: clientNameResolved,
        activity: activity,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        status: 'agendado'
      });
    }

    // Bulk create in batches of 100
    let created = 0;
    for (let i = 0; i < entries.length; i += 100) {
      const batch = entries.slice(i, i + 100);
      await base44.asServiceRole.entities.ScheduleEntry.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      success: true,
      total_rows: rows.length,
      created: created,
      skipped: skipped
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});