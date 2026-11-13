import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Users, Building2, Tag, Calendar, FileText, Map, Loader2, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

async function downloadAuditPDF(logs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const tableW = pageW - margin * 2;

  // Column definitions — fixed widths that fit within landscape A4
  const cols = [
    { label: "Data / Hora",  w: 38 },
    { label: "Usuário",      w: 28 },
    { label: "Categoria",    w: 28 },
    { label: "Ação",         w: 90 },
    { label: "Detalhes",     w: 0  }, // will fill remaining space
  ];
  cols[4].w = tableW - cols.slice(0, 4).reduce((s, c) => s + c.w, 0);
  // Calculate x positions
  let xAcc = margin;
  cols.forEach(c => { c.x = xAcc; xAcc += c.w; });

  const LOGO_URL = "https://media.base44.com/images/public/69ac93e375e4e4093788aef0/98ca518dd_Varejarte_logo_png__2_.png";

  // Load logo as base64
  let logoData = null;
  try {
    const resp = await fetch(LOGO_URL);
    const blob = await resp.blob();
    logoData = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { /* logo optional */ }

  const drawHeader = () => {
    // Blue header bar
    doc.setFillColor(30, 58, 95); // dark navy blue matching primary
    doc.rect(0, 0, pageW, 28, "F");

    // Logo
    if (logoData) {
      try { doc.addImage(logoData, "PNG", margin, 3, 40, 22); } catch {}
    }

    // Title text
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("Histórico de Alterações", logoData ? 54 : margin + 4, 14);
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 230);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} — ${logs.length} registros`, logoData ? 54 : margin + 4, 22);
  };

  const drawTableHeaders = (yPos) => {
    doc.setFillColor(235, 238, 245);
    doc.rect(margin, yPos - 5, tableW, 8, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 80);
    doc.setFont(undefined, "bold");
    cols.forEach(c => doc.text(c.label, c.x + 2, yPos));
    doc.setFont(undefined, "normal");
    return yPos + 7;
  };

  // --- First page ---
  drawHeader();
  let y = drawTableHeaders(36);

  doc.setFontSize(7);
  doc.setTextColor(40);

  const lineH = 3.5;
  const cellPad = 2;

  logs.forEach((log) => {
    const dateStr = log.created_date ? format(parseISO(log.created_date), "dd/MM/yyyy HH:mm") : "—";
    const catLabel = CATEGORY_CONFIG[log.category]?.label || log.category || "—";

    // Wrap ALL columns to fit within their fixed width
    doc.setFontSize(7);
    const dateLines = doc.splitTextToSize(dateStr, cols[0].w - cellPad * 2);
    const userLines = doc.splitTextToSize((log.user_name || "—"), cols[1].w - cellPad * 2);
    const catLines = doc.splitTextToSize(catLabel, cols[2].w - cellPad * 2);
    const actionLines = doc.splitTextToSize(log.action || "—", cols[3].w - cellPad * 2);
    const detailLines = doc.splitTextToSize(log.details || "—", cols[4].w - cellPad * 2);
    const maxLines = Math.max(dateLines.length, userLines.length, catLines.length, actionLines.length, detailLines.length, 1);
    const rowH = maxLines * lineH + 5;

    // New page check
    if (y + rowH > pageH - 10) {
      doc.addPage();
      drawHeader();
      y = drawTableHeaders(36);
      doc.setFontSize(7);
      doc.setTextColor(40);
    }

    // Alternating row background
    const rowIndex = logs.indexOf(log);
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, y - 3.5, tableW, rowH, "F");
    }

    // Cell text — each wrapped within its column
    doc.setTextColor(50);
    doc.text(dateLines, cols[0].x + cellPad, y);
    doc.text(userLines, cols[1].x + cellPad, y);
    doc.text(catLines, cols[2].x + cellPad, y);
    doc.text(actionLines, cols[3].x + cellPad, y);
    doc.text(detailLines, cols[4].x + cellPad, y);

    y += rowH;

    // Row separator line
    doc.setDrawColor(215, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 2, margin + tableW, y - 2);
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(150);
    doc.text(`Varejarte — Página ${i} de ${totalPages}`, pageW / 2, pageH - 5, { align: "center" });
  }

  doc.save("historico-alteracoes.pdf");
}

const CATEGORY_CONFIG = {
  colaborador: { label: "Colaborador", icon: Users, color: "text-blue-600 bg-blue-100" },
  cliente: { label: "Cliente", icon: Building2, color: "text-emerald-600 bg-emerald-100" },
  atividade: { label: "Atividade", icon: Tag, color: "text-amber-600 bg-amber-100" },
  agendamento: { label: "Agendamento", icon: Calendar, color: "text-purple-600 bg-purple-100" },
  relatorio: { label: "Relatório", icon: FileText, color: "text-rose-600 bg-rose-100" },
  cronograma: { label: "Cronograma", icon: Map, color: "text-cyan-600 bg-cyan-100" },
};

export default function AuditHistory() {
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 200),
  });

  const filtered = filterCategory === "all" ? logs : logs.filter((l) => l.category === filterCategory);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-primary" />
          Histórico de Alterações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Registro de todas as ações realizadas no sistema</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadAuditPDF(filtered)}>
            <Download className="w-4 h-4" />
            Baixar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-36">Data / Hora</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-32">Usuário</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-28">Categoria</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const cfg = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.agendamento;
                    const Icon = cfg.icon;
                    return (
                      <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {log.created_date ? format(parseISO(log.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{log.user_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span>{log.action}</span>
                          {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}