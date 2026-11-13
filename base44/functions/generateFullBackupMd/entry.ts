import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const [entries, employees, clients, activityTypes, auditLogs] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.ScheduleEntry),
      fetchAll(base44.asServiceRole.entities.Employee),
      fetchAll(base44.asServiceRole.entities.Client),
      fetchAll(base44.asServiceRole.entities.ActivityType),
      fetchAll(base44.asServiceRole.entities.AuditLog),
    ]);

    let md = `# Backup Completo Varejarte — ${dateStr}\n\n`;
    md += `> Gerado em ${dateStr} às ${pad(now.getHours())}:${pad(now.getMinutes())}\n\n`;

    // Resumo
    md += `## Resumo\n\n| Entidade | Registros |\n|---|---|\n`;
    md += `| Agendamentos | ${entries.length} |\n`;
    md += `| Colaboradores | ${employees.length} |\n`;
    md += `| Clientes | ${clients.length} |\n`;
    md += `| Tipos de Atividade | ${activityTypes.length} |\n`;
    md += `| Registros de Auditoria | ${auditLogs.length} |\n\n`;

    // Colaboradores
    md += `## Colaboradores\n\n`;
    for (const e of employees) {
      md += `### ${e.name || 'Sem nome'}\n\n`;
      md += `- **Cargo:** ${e.role || '-'}\n`;
      md += `- **Ativo:** ${e.active !== false ? 'Sim' : 'Não'}\n`;
      md += `- **Acesso:** ${e.access_type || 'viewer'}\n`;
      md += `- **Cor:** ${e.color || '-'}\n`;
      md += `- **Salário Mensal:** ${e.monthly_salary ? `R$ ${Number(e.monthly_salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}\n`;
      if (e.birthday_day && e.birthday_month) md += `- **Aniversário:** ${pad(e.birthday_day)}/${pad(e.birthday_month)}\n`;
      md += `- **Login:** ${e.login || '-'}\n`;
      md += `\n`;
    }

    // Clientes
    md += `## Clientes\n\n`;
    for (const c of clients) {
      md += `### ${c.company_name || 'Sem nome'}\n\n`;
      md += `- **Ativo:** ${c.active !== false ? 'Sim' : 'Não'}\n`;
      md += `- **Valor Contrato Mensal:** ${c.monthly_contract_value ? `R$ ${Number(c.monthly_contract_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}\n`;
      if (c.activity_notes) md += `- **Observações:** ${c.activity_notes}\n`;

      // Contatos
      if (c.contacts && c.contacts.length > 0) {
        md += `\n**Contatos:**\n\n`;
        for (const ct of c.contacts) {
          md += `- ${ct.name || '-'}`;
          if (ct.phone) md += ` | Tel: ${ct.phone}`;
          if (ct.email) md += ` | Email: ${ct.email}`;
          if (ct.birthday_day && ct.birthday_month) md += ` | Aniv: ${pad(ct.birthday_day)}/${pad(ct.birthday_month)}`;
          md += `\n`;
        }
      }

      // Filiais
      if (c.branches && c.branches.length > 0) {
        md += `\n**Filiais:**\n\n`;
        for (const b of c.branches) {
          md += `- **${b.name || '-'}**`;
          if (b.address) md += ` — ${b.address}`;
          md += ` (${b.active !== false ? 'Ativa' : 'Inativa'})`;
          md += `\n`;
          if (b.monthly_activities && b.monthly_activities.length > 0) {
            for (const ma of b.monthly_activities) {
              md += `  - ${ma.activity_type}: ${ma.quantity}x, ${ma.duration_minutes} min\n`;
            }
          }
        }
      }

      // Atividades mensais gerais
      if (c.monthly_activities && c.monthly_activities.length > 0) {
        md += `\n**Atividades Mensais (Geral):**\n\n`;
        for (const ma of c.monthly_activities) {
          md += `- ${ma.activity_type}: ${ma.quantity}x, ${ma.duration_minutes} min\n`;
        }
      }
      md += `\n---\n\n`;
    }

    // Tipos de Atividade
    md += `## Tipos de Atividade\n\n`;
    for (const a of activityTypes) md += `- ${a.name}\n`;
    md += `\n`;

    // Agendamentos — TODOS
    md += `## Agendamentos (${entries.length} registros)\n\n`;
    md += `| Data | Colaborador | Cliente | Atividade | Início | Fim | Status | Observações |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const e of entries) {
      md += `| ${e.date || ''} | ${e.employee_name || ''} | ${e.client_name || ''} | ${e.activity || ''} | ${e.start_time || ''} | ${e.end_time || ''} | ${e.status || ''} | ${(e.notes || '').replace(/\n/g, ' ')} |\n`;
    }
    md += `\n`;

    // Auditoria (últimos 200)
    md += `## Auditoria (últimos 200 registros)\n\n`;
    md += `| Data | Usuário | Categoria | Ação | Detalhes |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const a of auditLogs.slice(0, 200)) {
      const d = a.created_date ? new Date(a.created_date) : null;
      const dStr = d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
      md += `| ${dStr} | ${a.user_name || ''} | ${a.category || ''} | ${(a.action || '').replace(/\n/g, ' ')} | ${(a.details || '').replace(/\n/g, ' ')} |\n`;
    }

    return Response.json({ success: true, markdown: md, date: dateStr });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});