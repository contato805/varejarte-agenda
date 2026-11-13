import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import jsPDF from "jspdf";

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

const STATUS_CONFIG = {
  realizado:  { label: "Realizado",  className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  agendado:   { label: "Agendado",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  cancelado:  { label: "Cancelado",  className: "bg-red-100 text-red-600 border-red-200" },
};

export default function EmployeeTable({ entries, employeeName, periodLabel }) {
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const sorted = [...entries].sort((a, b) => {
    const cmp = (a.date || "").localeCompare(b.date || "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalHours = entries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);

  const toggleSort = () => setSortDir((d) => d === "asc" ? "desc" : "asc");

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 18, "F");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Varejarte Agenda", margin, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório por Colaborador — ${employeeName}`, pageWidth / 2, 11, { align: "center" });
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin, 11, { align: "right" });

    // Sub-header
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}  |  ${entries.length} atividades  |  ${totalHours.toFixed(1)}h totais`, margin, 26);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 30, pageWidth - margin, 30);

    // Table header
    const colWidths = [50, 40, 28, 30, 22, 14];
    const headers = ["Cliente", "Atividade", "Data", "Horário", "Status", "Horas"];
    let y = 40;

    doc.setFillColor(30, 64, 175);
    doc.rect(margin, y - 6, pageWidth - margin * 2, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    let x = margin + 2;
    headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    sorted.forEach((e, idx) => {
      if (y > 272) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 255);
        doc.rect(margin, y - 4, pageWidth - margin * 2, 7, "F");
      }
      doc.setTextColor(40, 40, 40);
      const statusLabel = STATUS_CONFIG[e.status]?.label || e.status || "-";
      const row = [
        e.client_name || "-",
        e.activity || "-",
        e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-",
        e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "-",
        statusLabel,
        calcHours(e.start_time, e.end_time).toFixed(1) + "h",
      ];
      x = margin + 2;
      row.forEach((cell, i) => {
        const maxW = colWidths[i] - 2;
        const txt = doc.getTextWidth(cell) > maxW ? doc.splitTextToSize(cell, maxW)[0] + "…" : cell;
        // Color for status
        if (i === 4) {
          if (e.status === "realizado") doc.setTextColor(4, 120, 87);
          else if (e.status === "cancelado") doc.setTextColor(185, 28, 28);
          else doc.setTextColor(29, 78, 216);
        } else {
          doc.setTextColor(40, 40, 40);
        }
        doc.text(txt, x, y);
        x += colWidths[i];
      });
      y += 7;
    });

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${entries.length} atividades | ${totalHours.toFixed(1)}h trabalhadas`, margin, y + 10);

    const safeName = employeeName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    doc.save(`relatorio_colaborador_${safeName}.pdf`);
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma atividade encontrada para este colaborador no período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{employeeName}</span>
          <span className="text-xs text-muted-foreground">— {entries.length} atividades · {totalHours.toFixed(1)}h</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExportPDF}>
          <Download className="w-3.5 h-3.5" />
          Exportar PDF
        </Button>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Atividade</th>
                <th
                  className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={toggleSort}
                >
                  <span className="flex items-center gap-1">
                    Data
                    {sortDir === "asc"
                      ? <ArrowUp className="w-3.5 h-3.5" />
                      : <ArrowDown className="w-3.5 h-3.5" />}
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Horário</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Horas</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG["agendado"];
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.employee_color || "#6366f1" }} />
                        {e.client_name || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.activity || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.date ? format(parseISO(e.date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sc.className}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {calcHours(e.start_time, e.end_time).toFixed(1)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td colSpan={5} className="px-4 py-2 text-xs text-muted-foreground font-medium">Total</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-sm">{totalHours.toFixed(1)}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}