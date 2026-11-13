import React, { useMemo, useImperativeHandle, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Building2, Clock, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import jsPDF from "jspdf";
import { normalizeEntryStatus } from "@/lib/normalizeEntryStatus";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

const STATUS_CONFIG = {
  realizado: { label: "Realizado", color: "#10b981" },
  agendado: { label: "Agendado", color: "#3b82f6" },
  cancelado: { label: "Cancelado", color: "#ef4444" },
};

const ReportClientsComponent = React.forwardRef(({ entries, clients, employees = [], periodLabel, selectedClients = [], selectedEmployees = [] }, ref) => {

  const normalizedEntries = useMemo(() => normalizeEntryStatus(entries), [entries]);

  // Filter by selected clients and employees
  const filteredEntries = useMemo(() => {
    let result = normalizedEntries;
    if (selectedClients.length > 0) {
      result = result.filter((e) => selectedClients.includes(e.client_name));
    }
    if (selectedEmployees.length > 0) {
      result = result.filter((e) => selectedEmployees.includes(e.employee_id));
    }
    return result;
  }, [normalizedEntries, selectedClients, selectedEmployees]);

  // Build stats grouped by client_name (each branch is a separate group)
  const clientStats = useMemo(() => {
    const byName = {};
    filteredEntries.forEach((e) => {
      const key = e.client_name || "Sem Cliente";
      if (!byName[key]) {
        // Try to find original client entity for contacts/monthly_activities
        const origClient = clients.find((c) => c.id === e.client_id);
        // Find matching branch monthly_activities
        let branchActivities = [];
        if (origClient) {
          const branches = origClient.branches || [];
          // Check if entry name contains a branch name
          const matchedBranch = branches.find((b) => b.name && key.includes(b.name));
          if (matchedBranch) {
            branchActivities = matchedBranch.monthly_activities || [];
          } else if (branches.length === 0) {
            branchActivities = origClient.monthly_activities || [];
          }
        }
        byName[key] = {
          company_name: key,
          client_id: e.client_id,
          contacts: origClient?.contacts || [],
          monthly_activities: branchActivities,
          entries: [],
        };
      }
      byName[key].entries.push(e);
    });

    return Object.values(byName).map((group) => {
      const hours = group.entries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
      const realized = group.entries.filter((e) => e.status === "realizado").length;
      const uniqueEmployees = [...new Set(group.entries.map((e) => e.employee_id).filter(Boolean))].length;
      const target = group.monthly_activities?.reduce((acc, a) => acc + (a.quantity || 0), 0) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((group.entries.length / target) * 100)) : null;
      return { ...group, count: group.entries.length, hours, realized, uniqueEmployees, target, pct };
    }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }, [filteredEntries, clients]);

  const byClient = useMemo(() => clientStats.map((c) => ({ name: c.company_name, count: c.count })), [clientStats]);
  const totalHours = filteredEntries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);

  const handleExportPDF = useCallback(async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header
    doc.setFillColor(30, 42, 94);
    doc.rect(0, 0, pageWidth, 30, "F");

    try {
      const logoUrl = "/brand/varejarte-branco.png";
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = logoUrl; });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const logoH = 24;
      const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
      doc.addImage(dataUrl, "PNG", margin, 3, logoW, logoH);
    } catch (_) {
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Varejarte", margin, 18);
    }

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório de Clientes", pageWidth / 2, 18, { align: "center" });
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin, 18, { align: "right" });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}  |  ${clientStats.length} clientes  |  ${filteredEntries.length} atividades  |  ${totalHours.toFixed(1)}h`, margin, 40);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 44, pageWidth - margin, 44);

    let y = 54;

    // Summary table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("Resumo por Cliente", margin, y);
    y += 7;

    const sumColWidths = [55, 20, 18, 20, 24, 30];
    const sumHeaders = ["Cliente", "Ativid.", "Horas", "Realizadas", "Colabor.", "Meta"];
    doc.setFillColor(16, 185, 129);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let sx = margin + 2;
    sumHeaders.forEach((h, i) => { doc.text(h, sx, y); sx += sumColWidths[i]; });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    clientStats.forEach((c, idx) => {
      const metaStr = c.target > 0 ? `${c.count}/${c.target} (${c.pct}%)` : "-";
      const row = [c.company_name, String(c.count), c.hours.toFixed(1) + "h", String(c.realized), String(c.uniqueEmployees), metaStr];
      const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, sumColWidths[i] - 3));
      const maxLines = Math.max(...wrapped.map((l) => l.length), 1);
      const rowH = Math.max(7, maxLines * 3.5 + 3);
      if (y + rowH > 275) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(240, 253, 250); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
      doc.setTextColor(40, 40, 40);
      sx = margin + 2;
      wrapped.forEach((lines, i) => { doc.text(lines, sx, y); sx += sumColWidths[i]; });
      y += rowH;
    });
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);

    // Per-client detail
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Detalhamento por Cliente", margin, y);
    y += 7;

    clientStats.forEach((client) => {
      if (y > 250) { doc.addPage(); y = 20; }

      // Contacts
      if (client.contacts && client.contacts.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const contactStr = "Contatos: " + client.contacts.map((c) => c.name + (c.phone ? ` (${c.phone})` : "")).join(" · ");
        const lines = doc.splitTextToSize(contactStr, pageWidth - margin * 2 - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 5 + 3;
      }

      // Table header
      const colWidths = [30, 32, 24, 24, 18, 32, 12];
      const headers = ["Responsável", "Atividade", "Data", "Horário", "Status", "Observações", "Horas"];
      doc.setFillColor(30, 42, 94);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      let x = margin + 2;
      headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      client.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e, idx) => {
        const statusLabel = STATUS_CONFIG[e.status]?.label || "-";
        const row = [
          e.employee_name || "-", e.activity || "-",
          e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-",
          e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : "-",
          statusLabel,
          e.notes || "-",
          calcHours(e.start_time, e.end_time).toFixed(1) + "h",
        ];
        const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, colWidths[i] - 3));
        const maxLines = Math.max(...wrapped.map((l) => l.length), 1);
        const rowH = Math.max(7, maxLines * 3.5 + 3);
        if (y + rowH > 275) { doc.addPage(); y = 20; }
        if (idx % 2 === 0) { doc.setFillColor(240, 253, 250); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
        x = margin + 2;
        wrapped.forEach((lines, i) => {
          if (i === 4) {
            if (e.status === "realizado") doc.setTextColor(4, 120, 87);
            else if (e.status === "cancelado") doc.setTextColor(185, 28, 28);
            else doc.setTextColor(29, 78, 216);
          } else { doc.setTextColor(40, 40, 40); }
          doc.text(lines, x, y);
          x += colWidths[i];
        });
        y += rowH;
      });

      // Subtotal
      doc.setFillColor(220, 225, 245);
      doc.rect(margin, y - 3, pageWidth - margin * 2, 7, "F");
      doc.setTextColor(30, 42, 94);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`Total: ${client.count} atividades | ${client.hours.toFixed(1)}h`, margin + 2, y + 1);
      doc.setFont("helvetica", "normal");
      y += 12;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: "center" });
      doc.text("Varejarte Agenda", pageWidth - margin, 290, { align: "right" });
    }

    doc.save(`Varejarte Consultoria - relatorio_clientes_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [filteredEntries, clientStats, periodLabel, totalHours]);

  useImperativeHandle(ref, () => ({ handleExportPDF }), [handleExportPDF]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img src="/brand/varejarte-branco.png" alt="Varejarte" style={{ height: 30 }} />
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#1e3480' }}>
          <Building2 className="w-5 h-5" style={{ color: '#1e3480' }} /> Relatório de Clientes
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clientStats.length}</p>
              <p className="text-xs text-muted-foreground">Clientes atendidos</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredEntries.length}</p>
              <p className="text-xs text-muted-foreground">Atividades totais</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Horas totais</p>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* Chart */}
      {byClient.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold" style={{ color: '#1e3480' }}>Atividades por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byClient} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Atividades" radius={[4, 4, 0, 0]}>
                  {byClient.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary table */}
      {clientStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1e3480' }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#1e3480' }} /> Resumo por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Atividades</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Realizadas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Colaboradores</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {clientStats.map((c, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{c.company_name}</td>
                      <td className="px-4 py-3 text-right">{c.count}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.hours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{c.realized}</td>
                      <td className="px-4 py-3 text-right">{c.uniqueEmployees}</td>
                      <td className="px-4 py-3 text-right">
                        {c.target > 0 ? (
                          <span className={`text-xs font-semibold ${c.pct >= 100 ? "text-emerald-600" : c.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                            {c.count}/{c.target} ({c.pct}%)
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-client detail tables */}
      {clientStats.map((client) => (
        <Card key={client.id}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ backgroundColor: '#1e348010' }}>
            <div>
              <p className="font-semibold text-sm">{client.company_name}</p>
              <p className="text-xs text-muted-foreground">
                {client.count} atividades · {client.hours.toFixed(1)}h · {client.uniqueEmployees} colaboradores
                {client.target > 0 && (
                  <span className={`ml-2 font-semibold ${client.pct >= 100 ? "text-green-600" : client.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                    Meta: {client.count}/{client.target} ({client.pct}%)
                  </span>
                )}
              </p>
            </div>
            {client.target > 0 && (
              <div className="w-32">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Meta mensal</span>
                  <span className={client.pct >= 100 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{client.pct}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${client.pct >= 100 ? "bg-emerald-500" : client.pct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${client.pct}%` }} />
                </div>
              </div>
            )}
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Responsável</th>
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Atividade</th>
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Data</th>
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Horário</th>
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Observações</th>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground text-xs">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {client.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((e, i) => {
                    const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG["agendado"];
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium text-sm break-words">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.employee_color || "#6366f1" }} />
                            <span className="break-words">{e.employee_name || "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-sm break-words">{e.activity || "-"}</td>
                        <td className="px-4 py-2 text-muted-foreground text-sm">
                          {e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: sc.color + "20", color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs break-words">{e.notes || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono font-medium text-sm">
                          {calcHours(e.start_time, e.end_time).toFixed(1)}h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t border-border">
                    <td colSpan={6} className="px-4 py-2 text-xs text-muted-foreground font-medium">Total</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-sm">{client.hours.toFixed(1)}h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {filteredEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma atividade encontrada para o período selecionado.
          </CardContent>
        </Card>
      )}
    </div>
  );
});

ReportClientsComponent.displayName = "ReportClients";

export default ReportClientsComponent;