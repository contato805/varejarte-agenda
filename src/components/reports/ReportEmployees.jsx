import React, { useMemo, useImperativeHandle, useCallback } from "react";
import { format, parseISO, subDays } from "date-fns";
import { formatCurrency } from "@/lib/formatCurrency";
import { ptBR } from "date-fns/locale";
import { User, Clock, Activity, Download, TrendingUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
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

const ReportEmployeesComponent = React.forwardRef(({ entries, employees, periodLabel, selectedEmployees = [] }, ref) => {

  const normalizedEntries = useMemo(() => normalizeEntryStatus(entries), [entries]);

  const filteredEntries = useMemo(() => {
    if (selectedEmployees.length === 0) return normalizedEntries;
    return normalizedEntries.filter((e) => selectedEmployees.includes(e.employee_id));
  }, [normalizedEntries, selectedEmployees]);

  const filteredEmployees = useMemo(() => {
    if (selectedEmployees.length === 0) return employees;
    return employees.filter((e) => selectedEmployees.includes(e.id));
  }, [employees, selectedEmployees]);

  const employeeStats = useMemo(() => {
    return filteredEmployees.map((emp) => {
      const empEntries = filteredEntries.filter((e) => e.employee_id === emp.id);
      const hours = empEntries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
      const realized = empEntries.filter((e) => e.status === "realizado").length;
      const cancelled = empEntries.filter((e) => e.status === "cancelado").length;
      const uniqueClients = [...new Set(empEntries.map((e) => e.client_id).filter(Boolean))].length;
      // Group entries by client + branch (using client_name which includes branch)
      const byClient = {};
      empEntries.forEach((e) => {
        const key = e.client_name || e.client_id || "sem_cliente";
        if (!byClient[key]) byClient[key] = { client_name: e.client_name || "Sem Cliente", entries: [] };
        byClient[key].entries.push(e);
      });
      const clientGroups = Object.values(byClient).sort((a, b) => a.client_name.localeCompare(b.client_name));
      return { ...emp, count: empEntries.length, hours, realized, cancelled, uniqueClients, entries: empEntries, clientGroups };
    }).filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
  }, [filteredEntries, filteredEmployees]);

  const byActivity = useMemo(() => {
    const map = {};
    filteredEntries.forEach((e) => { map[e.activity || "Outro"] = (map[e.activity || "Outro"] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredEntries]);

  const totalHours = filteredEntries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);

  const handleExportPDF = useCallback(async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header
    doc.setFillColor(30, 42, 94);
    doc.rect(0, 0, pageWidth, 30, "F");

    // Try to add logo image
    try {
      const logoUrl = "https://media.base44.com/images/public/69ac93e375e4e4093788aef0/71328dedf_varejartelogotracadobranco.png";
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
    doc.text(`Relatório de Colaboradores`, pageWidth / 2, 18, { align: "center" });
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin, 18, { align: "right" });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}  |  ${filteredEmployees.length} colaboradores  |  ${filteredEntries.length} atividades  |  ${totalHours.toFixed(1)}h totais`, margin, 40);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 44, pageWidth - margin, 44);

    let y = 54;

    // Summary table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Resumo por Colaborador", margin, y);
    y += 7;

    const sumColWidths = [48, 30, 18, 18, 20, 20, 18];
    const sumHeaders = ["Colaborador", "Cargo", "Ativid.", "Horas", "Realiz.", "Cancel.", "Clientes"];
    doc.setFillColor(30, 42, 94);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let sx = margin + 2;
    sumHeaders.forEach((h, i) => { doc.text(h, sx, y); sx += sumColWidths[i]; });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    employeeStats.forEach((emp, idx) => {
      const row = [emp.name, emp.role || "-", String(emp.count), emp.hours.toFixed(1) + "h", String(emp.realized), String(emp.cancelled), String(emp.uniqueClients)];
      const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, sumColWidths[i] - 3));
      const maxLines = Math.max(...wrapped.map((l) => l.length), 1);
      const rowH = Math.max(7, maxLines * 3.5 + 3);
      if (y + rowH > 275) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 255); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
      doc.setTextColor(40, 40, 40);
      sx = margin + 2;
      wrapped.forEach((lines, i) => { doc.text(lines, sx, y); sx += sumColWidths[i]; });
      y += rowH;
    });
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);

    // Per employee detail (grouped by client)
    employeeStats.forEach((emp) => {
      if (y > 250) { doc.addPage(); y = 20; }

      // Employee header
      doc.setFillColor(230, 235, 255);
      doc.rect(margin, y - 6, pageWidth - margin * 2, 10, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 42, 94);
      doc.text(`${emp.name}  |  ${emp.role || ""}`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`${emp.count} atividades · ${emp.hours.toFixed(1)}h · ${emp.uniqueClients} clientes · ${emp.realized} realizados · ${emp.cancelled} cancelados`, margin + 2, y + 7);
      y += 14;

      // Group by client in PDF
      const colWidths = [38, 28, 22, 18, 42, 12];
      const headers = ["Atividade", "Data", "Horário", "Status", "Observações", "Horas"];

      emp.clientGroups.forEach((cg) => {
        if (y > 255) { doc.addPage(); y = 20; }
        // Client sub-header
        doc.setFillColor(240, 242, 255);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        const cgHours = cg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
        doc.text(`${cg.client_name}  (${cg.entries.length} ativ. · ${cgHours.toFixed(1)}h)`, margin + 2, y);
        y += 6;

        // Table header
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
        cg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e, idx) => {
          const statusLabel = STATUS_CONFIG[e.status]?.label || "-";
          const row = [
            e.activity || "-",
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
          if (idx % 2 === 0) { doc.setFillColor(248, 250, 255); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
          x = margin + 2;
          wrapped.forEach((lines, i) => {
            if (i === 3) {
              if (e.status === "realizado") doc.setTextColor(4, 120, 87);
              else if (e.status === "cancelado") doc.setTextColor(185, 28, 28);
              else doc.setTextColor(29, 78, 216);
            } else { doc.setTextColor(40, 40, 40); }
            doc.text(lines, x, y);
            x += colWidths[i];
          });
          y += rowH;
        });
        y += 3;
      });

      // Subtotal row
      doc.setFillColor(220, 225, 245);
      doc.rect(margin, y - 3, pageWidth - margin * 2, 7, "F");
      doc.setTextColor(30, 42, 94);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`Total: ${emp.count} atividades | ${emp.hours.toFixed(1)}h`, margin + 2, y + 1);
      doc.setFont("helvetica", "normal");
      y += 12;
    });

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: "center" });
      doc.text("Varejarte Agenda", pageWidth - margin, 290, { align: "right" });
    }

    doc.save(`Varejarte Consultoria - relatorio_colaboradores_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [filteredEntries, filteredEmployees, periodLabel, employeeStats, totalHours]);

  useImperativeHandle(ref, () => ({ handleExportPDF }), [handleExportPDF]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img src="https://media.base44.com/images/public/69ac93e375e4e4093788aef0/71328dedf_varejartelogotracadobranco.png" alt="Varejarte" style={{ height: 30 }} />
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#1e3480' }}>
          <User className="w-5 h-5" style={{ color: '#1e3480' }} /> Relatório de Colaboradores
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employeeStats.length}</p>
              <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredEntries.length}</p>
              <p className="text-xs text-muted-foreground">Total de atividades</p>
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
      {byActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold" style={{ color: '#1e3480' }}>Atividades por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byActivity} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Atividades" radius={[4, 4, 0, 0]}>
                  {byActivity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary table */}
      {employeeStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1e3480' }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#1e3480' }} /> Resumo por Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Colaborador</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cargo</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Atividades</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Realizadas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Canceladas</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((emp, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color || "#6366f1" }} />
                          {emp.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{emp.role || "—"}</td>
                      <td className="px-4 py-3 text-right">{emp.count}</td>
                      <td className="px-4 py-3 text-right font-mono">{emp.hours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{emp.realized}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{emp.cancelled}</td>
                      <td className="px-4 py-3 text-right">{emp.uniqueClients}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-employee detail tables grouped by client */}
      {employeeStats.map((emp) => (
        <Card key={emp.id}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: emp.color || "#6366f1" }}>
                {emp.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sm">{emp.name}</p>
                <p className="text-xs text-muted-foreground">{emp.role || ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{emp.count}</strong> atividades</span>
              <span><strong className="text-foreground">{emp.hours.toFixed(1)}h</strong></span>
              <span><strong className="text-emerald-600">{emp.realized}</strong> realizadas</span>
              <span><strong className="text-red-500">{emp.cancelled}</strong> canceladas</span>
            </div>
          </div>
          <CardContent className="p-0 divide-y divide-border">
            {emp.clientGroups.map((cg, ci) => {
              const cgHours = cg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
              const cgRealized = cg.entries.filter((e) => e.status === "realizado").length;
              return (
                <div key={ci}>
                  <div className="flex items-center justify-between px-4 py-2 bg-accent/30">
                    <p className="text-sm font-semibold">{cg.client_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{cg.entries.length} atividades</span>
                      <span>{cgHours.toFixed(1)}h</span>
                      <span className="text-emerald-600">{cgRealized} realizadas</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '27%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Atividade</th>
                          <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Data</th>
                          <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Horário</th>
                          <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Status</th>
                          <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">Observações</th>
                          <th className="text-right px-4 py-2 font-semibold text-muted-foreground text-xs">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((e, i) => {
                          const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG["agendado"];
                          return (
                            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2 text-sm break-words">{e.activity || "-"}</td>
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
                    </table>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border">
            <span className="text-xs text-muted-foreground font-medium">Total {emp.name}</span>
            <span className="font-mono font-bold text-sm">{emp.hours.toFixed(1)}h</span>
          </div>
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

ReportEmployeesComponent.displayName = "ReportEmployees";

export default ReportEmployeesComponent;