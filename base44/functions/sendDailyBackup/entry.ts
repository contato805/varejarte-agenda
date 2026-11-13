import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function fetchAll(entity) {
  const results = [];
  let skip = 0;
  while (true) {
    const batch = await entity.list("-created_date", 500, skip);
    results.push(...batch);
    if (batch.length < 500) break;
    skip += 500;
  }
  return results;
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function csvEsc(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const dateStr = fmtDate(now);
    const isoDate = now.toISOString().slice(0, 10);

    const [entries, employees, clients, activityTypes, auditLogs] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.ScheduleEntry),
      fetchAll(base44.asServiceRole.entities.Employee),
      fetchAll(base44.asServiceRole.entities.Client),
      fetchAll(base44.asServiceRole.entities.ActivityType),
      fetchAll(base44.asServiceRole.entities.AuditLog),
    ]);

    // === Markdown ===
    let md = `# Backup Varejarte — ${dateStr}\n\n`;
    md += `> Gerado em ${dateStr} às ${pad(now.getHours())}:${pad(now.getMinutes())}\n\n`;
    md += `## Resumo\n\n| Entidade | Registros |\n|---|---|\n`;
    md += `| Agendamentos | ${entries.length} |\n| Colaboradores | ${employees.length} |\n| Clientes | ${clients.length} |\n| Atividades | ${activityTypes.length} |\n| Auditoria | ${auditLogs.length} |\n\n`;

    md += `## Colaboradores\n\n| Nome | Cargo | Ativo | Acesso | Salário |\n|---|---|---|---|---|\n`;
    for (const e of employees) md += `| ${e.name||''} | ${e.role||'-'} | ${e.active!==false?'Sim':'Não'} | ${e.access_type||'viewer'} | ${e.monthly_salary||'-'} |\n`;

    md += `\n## Clientes\n\n| Empresa | Ativo | Valor Contrato | Filiais |\n|---|---|---|---|\n`;
    for (const c of clients) md += `| ${c.company_name||''} | ${c.active!==false?'Sim':'Não'} | ${c.monthly_contract_value||'-'} | ${(c.branches||[]).length} |\n`;

    md += `\n## Agendamentos (${entries.length})\n\n| Data | Colaborador | Cliente | Atividade | Início | Fim | Status |\n|---|---|---|---|---|---|---|\n`;
    for (const e of entries.slice(0, 300)) md += `| ${e.date||''} | ${e.employee_name||''} | ${e.client_name||''} | ${e.activity||''} | ${e.start_time||''} | ${e.end_time||''} | ${e.status||''} |\n`;

    md += `\n## Atividades\n\n`;
    for (const a of activityTypes) md += `- ${a.name}\n`;

    // === CSV (abre no Excel) ===
    let csv = '\uFEFF' + 'Data,Colaborador,Cliente,Atividade,Inicio,Fim,Status,Observacoes\n';
    for (const e of entries) csv += [e.date, e.employee_name, e.client_name, e.activity, e.start_time, e.end_time, e.status, e.notes].map(csvEsc).join(',') + '\n';

    let csvEmp = '\uFEFF' + 'Nome,Cargo,Ativo,Acesso,Salario,Aniversario\n';
    for (const e of employees) csvEmp += [e.name, e.role, e.active!==false?'Sim':'Não', e.access_type||'viewer', e.monthly_salary, e.birthday_day&&e.birthday_month?`${pad(e.birthday_day)}/${pad(e.birthday_month)}`:''].map(csvEsc).join(',') + '\n';

    let csvCli = '\uFEFF' + 'Empresa,Ativo,ValorContrato,Filiais,Observacoes\n';
    for (const c of clients) csvCli += [c.company_name, c.active!==false?'Sim':'Não', c.monthly_contract_value, (c.branches||[]).map(b=>b.name).join('; '), c.activity_notes].map(csvEsc).join(',') + '\n';

    // Upload
    const mdFile = new File([md], `backup-${isoDate}.md`, { type: 'text/plain' });
    const csvFile = new File([csv], `agendamentos-${isoDate}.csv`, { type: 'text/csv' });
    const csvEmpFile = new File([csvEmp], `colaboradores-${isoDate}.csv`, { type: 'text/csv' });
    const csvCliFile = new File([csvCli], `clientes-${isoDate}.csv`, { type: 'text/csv' });

    const [mdUp, csvUp, csvEmpUp, csvCliUp] = await Promise.all([
      base44.asServiceRole.integrations.Core.UploadFile({ file: mdFile }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: csvFile }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: csvEmpFile }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: csvCliFile }),
    ]);

    const emailBody = `<h2>Backup Diário Varejarte — ${dateStr}</h2>
<p>Backup automático dos dados do sistema.</p>
<h3>Resumo:</h3>
<ul>
<li><strong>Agendamentos:</strong> ${entries.length}</li>
<li><strong>Colaboradores:</strong> ${employees.length}</li>
<li><strong>Clientes:</strong> ${clients.length}</li>
<li><strong>Atividades:</strong> ${activityTypes.length}</li>
<li><strong>Auditoria:</strong> ${auditLogs.length}</li>
</ul>
<h3>Arquivos:</h3>
<ul>
<li><a href="${mdUp.file_url}">📄 Backup completo (.md)</a></li>
<li><a href="${csvUp.file_url}">📊 Agendamentos (.csv)</a></li>
<li><a href="${csvEmpUp.file_url}">👥 Colaboradores (.csv)</a></li>
<li><a href="${csvCliUp.file_url}">🏢 Clientes (.csv)</a></li>
</ul>
<p style="color:#666;font-size:11px;">Os arquivos CSV abrem direto no Excel. Gerado em ${dateStr} às ${pad(now.getHours())}:${pad(now.getMinutes())}.</p>`;

    const recipients = ['contato@sejadominio.com.br', 'jhongrimm18@gmail.com'];
    const results = [];
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject: `[Varejarte] Backup Diário — ${dateStr}`,
          body: emailBody,
          from_name: 'Varejarte Backup',
        });
        results.push({ to, sent: true });
      } catch (err) {
        results.push({ to, sent: false, error: err.message });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});