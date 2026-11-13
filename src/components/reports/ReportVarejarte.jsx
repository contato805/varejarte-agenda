import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Building2, User, Clock, Activity, TrendingUp,
  AlertTriangle, CheckCircle2, Zap, DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from "recharts";
import jsPDF from "jspdf";
import { normalizeEntryStatus } from "@/lib/normalizeEntryStatus";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

// Build display name: "Empresa — Filial" if branch differs from company, otherwise just the name
function buildClientDisplayName(clientName, clientId, clients) {
  const parent = clients.find((c) => c.id === clientId);
  if (!parent) return clientName || "Sem Cliente";
  const companyName = parent.company_name || "";
  // If the client_name is the same as company_name, no need to prefix
  if (!clientName || clientName === companyName) return companyName || clientName || "Sem Cliente";
  // If client_name already contains "—", extract the branch part and rebuild with correct company name
  if (clientName.includes("—")) {
    const branchPart = clientName.split("—").slice(1).join("—").trim();
    return `${companyName} — ${branchPart}`;
  }
  return `${companyName} — ${clientName}`;
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function InsightBadge({ type, text }) {
  const cfg = {
    success: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle2 },
    warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: AlertTriangle },
    info: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: Zap },
  }[type] || { bg: "bg-muted border-border", text: "text-foreground", icon: Zap };
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${cfg.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
      <p className={`text-sm ${cfg.text}`}>{text}</p>
    </div>
  );
}

const ReportVarejarteComponent = React.forwardRef(({ entries: rawEntries, clients, employees, periodLabel, allEntries: rawAllEntries }, ref) => {
  const entries = useMemo(() => normalizeEntryStatus(rawEntries), [rawEntries]);
  const allEntries = useMemo(() => rawAllEntries ? normalizeEntryStatus(rawAllEntries) : entries, [rawAllEntries, entries]);
  const totalHours = entries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
  const realized = entries.filter((e) => e.status === "realizado").length;
  const cancelled = entries.filter((e) => e.status === "cancelado").length;

  // Determine if an entry belongs to a branch or to the group level
  // Entry is "group-level" when client_name equals company_name (no branch)
  // Entry is "branch-level" when client_name contains "—" or matches a branch name
  function classifyEntry(e) {
    const parent = clients.find((c) => c.id === e.client_id);
    if (!parent) return { level: "group", branchKey: null };
    const companyName = parent.company_name || "";
    const clientName = e.client_name || "";
    // If client_name is the company_name itself, it's a group-level entry
    if (clientName === companyName) return { level: "group", branchKey: null };
    // If client_name contains "—", it's a branch entry — extract branch name after "—"
    if (clientName.includes("—")) {
      const branchName = clientName.split("—").slice(1).join("—").trim();
      return { level: "branch", branchKey: `${e.client_id}::${branchName}`, branchName };
    }
    // Check if client_name matches a branch name
    const matchedBranch = parent.branches?.find((b) => b.name === clientName);
    if (matchedBranch) return { level: "branch", branchKey: `${e.client_id}::${clientName}`, branchName: clientName };
    // Fallback: treat as group-level
    return { level: "group", branchKey: null };
  }

  // Client stats grouped by branch (client_name) with cost — NO duplication
  const clientStats = useMemo(() => {
    const byBranch = {};
    entries.forEach((e) => {
      const key = e.client_name || "Sem Cliente";
      if (!byBranch[key]) {
        const parent = clients.find((c) => c.id === e.client_id);
        const companyName = parent?.company_name || key;
        const displayName = buildClientDisplayName(e.client_name, e.client_id, clients);
        // Find branch-level target from parent client
        let target = 0;
        if (parent) {
          const { level, branchName } = classifyEntry(e);
          if (level === "branch" && branchName) {
            const branch = parent.branches?.find((b) => b.name === branchName);
            if (branch) {
              target = branch.monthly_activities?.reduce((acc, a) => acc + (a.quantity || 0), 0) || 0;
            }
          } else {
            target = parent.monthly_activities?.reduce((acc, a) => acc + (a.quantity || 0), 0) || 0;
          }
        }
        byBranch[key] = { company_name: companyName, display_name: displayName, client_id: e.client_id, count: 0, hours: 0, cost: 0, target, entries: [] };
      }
      byBranch[key].count += 1;
      byBranch[key].hours += calcHours(e.start_time, e.end_time);
      byBranch[key].entries.push(e);
      if (e.status !== "cancelado") {
        const emp = employees.find((em) => em.id === e.employee_id);
        const monthlySalary = emp?.monthly_salary || 0;
        const costPerHour = monthlySalary > 0 ? monthlySalary / 176 : 0;
        byBranch[key].cost += calcHours(e.start_time, e.end_time) * costPerHour;
      }
    });
    return Object.values(byBranch).map((b) => ({
      ...b,
      pct: b.target > 0 ? Math.min(100, Math.round((b.count / b.target) * 100)) : null,
    })).sort((a, b) => {
      const cmp = a.company_name.localeCompare(b.company_name, 'pt-BR');
      if (cmp !== 0) return cmp;
      return a.display_name.localeCompare(b.display_name, 'pt-BR');
    });
  }, [entries, clients, employees]);

  // Employee stats with client groups
  const employeeStats = useMemo(() => {
    return employees.map((emp) => {
      const eEntries = entries.filter((e) => e.employee_id === emp.id);
      const hours = eEntries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
      const costPerHour = (emp.monthly_salary || 0) / 176;
      const nonCancelledHours = eEntries.filter(e => e.status !== "cancelado").reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
      const cost = nonCancelledHours * costPerHour;
      // Group by client
      const byClient = {};
      eEntries.forEach((e) => {
        const key = e.client_id || "sem_cliente";
        if (!byClient[key]) byClient[key] = { client_name: e.client_name || "Sem Cliente", display_name: buildClientDisplayName(e.client_name, e.client_id, clients), entries: [] };
        byClient[key].entries.push(e);
      });
      const clientGroups = Object.values(byClient).sort((a, b) => a.client_name.localeCompare(b.client_name));
      return { ...emp, count: eEntries.length, hours, cost, clientGroups };
    }).filter((e) => e.count > 0).sort((a, b) => b.hours - a.hours);
  }, [entries, employees]);

  const totalCost = employeeStats.reduce((acc, e) => acc + e.cost, 0);
  const avgCostPerActivity = entries.length > 0 ? totalCost / entries.length : 0;

  // Revenue: sum of monthly_contract_value for active clients with realized activities in period
  const totalRevenue = useMemo(() => {
    const clientIdsWithRealized = new Set(
      entries.filter((e) => e.status === "realizado").map((e) => e.client_id).filter(Boolean)
    );
    return clients
      .filter((c) => c.active !== false && clientIdsWithRealized.has(c.id) && (c.monthly_contract_value || 0) > 0)
      .reduce((acc, c) => acc + (c.monthly_contract_value || 0), 0);
  }, [entries, clients]);

  // By activity type
  const byActivity = useMemo(() => {
    const map = {};
    entries.forEach((e) => { map[e.activity || "Outro"] = (map[e.activity || "Outro"] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [entries]);

  // Status distribution
  const statusData = useMemo(() => [
    { name: "Realizados", count: realized, color: "#10b981" },
    { name: "Agendados", count: entries.filter((e) => e.status === "agendado").length, color: "#3b82f6" },
    { name: "Cancelados", count: cancelled, color: "#ef4444" },
  ].filter((d) => d.count > 0), [entries, realized, cancelled]);

  // Insights (last 30 days)
  const insights = useMemo(() => {
    const list = [];
    if (entries.length === 0) return list;

    const cancelRate = entries.length > 0 ? (cancelled / entries.length) * 100 : 0;
     if (cancelRate > 20) list.push({ type: "warning", text: `Taxa de cancelamento alta: ${cancelRate.toFixed(0)}% das atividades foram canceladas no período.` });
     else if (cancelRate === 0) list.push({ type: "success", text: "Sem cancelamentos no período! Excelente taxa de realização." });
     else list.push({ type: "info", text: `Taxa de cancelamento: ${cancelRate.toFixed(0)}% — dentro do esperado.` });

     // Top client
     if (clientStats.length > 0) {
       const top = clientStats[0];
       list.push({ type: "info", text: `Cliente mais atendido: ${top.display_name} com ${top.count} atividades (${top.hours.toFixed(1)}h).` });
     }

     // Top employee
     if (employeeStats.length > 0) {
       const top = employeeStats[0];
       list.push({ type: "info", text: `Colaborador mais ativo: ${top.name} com ${top.count} atividades e ${top.hours.toFixed(1)}h registradas.` });
     }

     // Clients below target
     const belowTarget = clientStats.filter((c) => c.target > 0 && c.pct !== null && c.pct < 80);
     if (belowTarget.length > 0) {
       list.push({ type: "warning", text: `${belowTarget.length} cliente(s) abaixo de 80% da meta: ${belowTarget.map((c) => c.display_name).join(", ")}.` });
     }

     // Clients above target
     const aboveTarget = clientStats.filter((c) => c.target > 0 && c.pct !== null && c.pct >= 100);
     if (aboveTarget.length > 0) {
       list.push({ type: "success", text: `${aboveTarget.length} cliente(s) atingiram ou superaram a meta: ${aboveTarget.map((c) => c.display_name).join(", ")}.` });
     }

     // Cost per hour
     if (totalCost > 0) {
       list.push({ type: "info", text: `Custo médio por atividade: R$ ${formatCurrency(avgCostPerActivity)}. Custo total estimado: R$ ${formatCurrency(totalCost)}.` });
       const highCost = clientStats.filter((c) => c.cost > 0).sort((a, b) => b.cost - a.cost)[0];
       if (highCost) list.push({ type: "info", text: `Cliente com maior custo alocado: ${highCost.display_name} — R$ ${formatCurrency(highCost.cost)}.` });
     }

    return list;
  }, [entries, clientStats, employeeStats, cancelled, realized, totalCost, avgCostPerActivity]);

  const handleExportPDF = React.useCallback(async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Cover
    doc.setFillColor(30, 42, 94);
    doc.rect(0, 0, pageWidth, 38, "F");

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
      const logoH = 28;
      const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
      doc.addImage(dataUrl, "PNG", margin, 5, logoW, logoH);
    } catch (_) {
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Varejarte Agenda", margin, 22);
    }

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório Consolidado Varejarte", pageWidth / 2, 20, { align: "center" });
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin, 20, { align: "right" });
    doc.setFontSize(9);
    doc.text(`Período: ${periodLabel}`, pageWidth / 2, 30, { align: "center" });

    let y = 48;

    // Summary stat cards
    const realizationRate = entries.length > 0 ? Math.round((realized / entries.length) * 100) : 0;

    const statCards = [
      { label: "Atividades", value: String(entries.length), sub: `${realized} realizadas · ${cancelled} canceladas`, color: [59, 130, 246] },
      { label: "Horas totais", value: `${totalHours.toFixed(1)}h`, sub: `${employeeStats.length} colaboradores · ${clientStats.length} clientes`, color: [245, 158, 11] },
      { label: "Taxa de realização", value: `${realizationRate}%`, sub: realizationRate >= 90 ? "Excelente" : realizationRate >= 70 ? "Bom" : "Atenção", color: [16, 185, 129] },
      { label: totalCost > 0 ? "Custo estimado" : "Cancelamentos", value: totalCost > 0 ? `R$ ${formatCurrency(totalCost)}` : String(cancelled), sub: totalCost > 0 ? `Médio/ativ: R$ ${formatCurrency(avgCostPerActivity)}` : `de ${entries.length} atividades`, color: totalCost > 0 ? [139, 92, 246] : [239, 68, 68] },
    ];
    if (totalRevenue > 0) {
      const marginValue = totalRevenue - totalCost;
      statCards.push({ label: "Faturamento estimado", value: `R$ ${formatCurrency(totalRevenue)}`, sub: totalCost > 0 ? `Margem: R$ ${formatCurrency(marginValue)}` : "Clientes ativos c/ realizações", color: [16, 185, 129] });
    }

    const cardW = (pageWidth - margin * 2 - (statCards.length - 1) * 3) / statCards.length;
    const cardH = 22;
    const cardY = y;

    statCards.forEach((card, i) => {
      const cx = margin + i * (cardW + 3);
      // Card background
      doc.setFillColor(250, 250, 255);
      doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(220, 225, 240);
      doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, "S");
      // Color accent bar
      doc.setFillColor(...card.color);
      doc.rect(cx, cardY, 1.5, cardH, "F");
      // Icon circle
      doc.setFillColor(card.color[0], card.color[1], card.color[2], 0.15);
      doc.setFillColor(Math.min(255, card.color[0] + 180), Math.min(255, card.color[1] + 180), Math.min(255, card.color[2] + 180));
      doc.circle(cx + 7, cardY + 8, 3.5, "F");
      doc.setFillColor(...card.color);
      doc.circle(cx + 7, cardY + 8, 1.5, "F");
      // Value
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 50);
      doc.text(card.value, cx + 14, cardY + 9);
      // Label
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 120);
      doc.text(card.label, cx + 14, cardY + 14);
      // Sub
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 160);
      doc.text(doc.splitTextToSize(card.sub, cardW - 16).slice(0, 1), cx + 14, cardY + 18.5);
    });

    y = cardY + cardH + 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Charts section
    if (byActivity.length > 0 || employeeStats.length > 0) {
      const chartAreaW = pageWidth - margin * 2;
      const chartColW = (chartAreaW - 6) / 2;
      const chartH = 60;
      const chartStartY = y;

      // Helper: draw bar chart
      const drawBarChart = (title, data, cx, cy, w, h) => {
        // Title
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 42, 94);
        doc.text(title, cx + 2, cy);
        const barAreaY = cy + 5;
        const barAreaH = h - 8;
        const barCount = Math.min(data.length, 8);
        if (barCount === 0) return;
        const maxVal = Math.max(...data.map(d => d.count), 1);
        const barH = Math.min(6, (barAreaH - 2) / barCount - 1);
        const labelW = 38;
        const barMaxW = w - labelW - 20;

        data.slice(0, barCount).forEach((d, i) => {
          const by = barAreaY + i * (barH + 1.5);
          // Label
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          const label = doc.splitTextToSize(d.name, labelW - 2)[0];
          doc.text(label, cx + 2, by + barH / 2 + 1.5);
          // Bar background
          doc.setFillColor(235, 238, 248);
          doc.roundedRect(cx + labelW, by, barMaxW, barH, 1, 1, "F");
          // Bar fill
          const bw = Math.max(2, (d.count / maxVal) * barMaxW);
          const color = CHART_COLORS[i % CHART_COLORS.length];
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
          doc.roundedRect(cx + labelW, by, bw, barH, 1, 1, "F");
          // Value
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(60, 60, 60);
          doc.text(String(d.count), cx + labelW + bw + 2, by + barH / 2 + 1.5);
        });
      };

      // Draw activity chart (left)
      if (byActivity.length > 0) {
        doc.setFillColor(250, 250, 255);
        doc.roundedRect(margin, chartStartY - 2, chartColW, chartH, 2, 2, "F");
        doc.setDrawColor(220, 225, 240);
        doc.roundedRect(margin, chartStartY - 2, chartColW, chartH, 2, 2, "S");
        drawBarChart("Atividades por Tipo", byActivity, margin + 2, chartStartY + 2, chartColW - 4, chartH - 4);
      }

      // Draw employee chart (right)
      if (employeeStats.length > 0) {
        const empChartData = employeeStats.map(e => ({ name: e.name.split(" ")[0], count: e.count }));
        const rightX = margin + chartColW + 6;
        doc.setFillColor(250, 250, 255);
        doc.roundedRect(rightX, chartStartY - 2, chartColW, chartH, 2, 2, "F");
        doc.setDrawColor(220, 225, 240);
        doc.roundedRect(rightX, chartStartY - 2, chartColW, chartH, 2, 2, "S");
        drawBarChart("Atividades por Colaborador", empChartData, rightX + 2, chartStartY + 2, chartColW - 4, chartH - 4);
      }

      y = chartStartY + chartH + 4;

      // Status pie chart (drawn as horizontal stacked bar + legend)
      if (statusData.length > 0) {
        const pieBoxW = chartAreaW;
        const pieBoxH = 20;
        doc.setFillColor(250, 250, 255);
        doc.roundedRect(margin, y - 2, pieBoxW, pieBoxH, 2, 2, "F");
        doc.setDrawColor(220, 225, 240);
        doc.roundedRect(margin, y - 2, pieBoxW, pieBoxH, 2, 2, "S");

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 42, 94);
        doc.text("Status das Atividades", margin + 4, y + 4);

        const totalCount = statusData.reduce((a, d) => a + d.count, 0);
        const barStartX = margin + 4;
        const barW = pieBoxW - 8;
        const barY = y + 7;
        const barH2 = 4;
        let bx = barStartX;
        statusData.forEach((d) => {
          const w = (d.count / totalCount) * barW;
          const r = parseInt(d.color.slice(1, 3), 16);
          const g = parseInt(d.color.slice(3, 5), 16);
          const b = parseInt(d.color.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
          doc.rect(bx, barY, w, barH2, "F");
          bx += w;
        });

        // Legend
        let lx = barStartX;
        const ly = barY + barH2 + 3.5;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        statusData.forEach((d) => {
          const r = parseInt(d.color.slice(1, 3), 16);
          const g = parseInt(d.color.slice(3, 5), 16);
          const b = parseInt(d.color.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
          doc.circle(lx + 1.5, ly - 1, 1.5, "F");
          doc.setTextColor(60, 60, 60);
          const pct = totalCount > 0 ? Math.round((d.count / totalCount) * 100) : 0;
          const txt = `${d.name} ${d.count} (${pct}%)`;
          doc.text(txt, lx + 5, ly);
          lx += doc.getTextWidth(txt) + 12;
        });

        y += pieBoxH + 4;
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    }

    // Insights
    if (insights.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 42, 94);
      doc.text("Insights & Análises", margin, y);
      y += 8;

      const insightW = pageWidth - margin * 2;
      insights.forEach((ins) => {
        if (y > 265) { doc.addPage(); y = 20; }
        
        let bgColor, accentColor, textColor, icon;
        if (ins.type === "success") {
          bgColor = [240, 253, 244]; accentColor = [16, 185, 129]; textColor = [4, 100, 70]; icon = "✓";
        } else if (ins.type === "warning") {
          bgColor = [255, 251, 235]; accentColor = [245, 158, 11]; textColor = [146, 84, 0]; icon = "!";
        } else {
          bgColor = [239, 246, 255]; accentColor = [59, 130, 246]; textColor = [29, 64, 175]; icon = "→";
        }

        const lines = doc.splitTextToSize(ins.text, insightW - 18);
        const boxH = Math.max(8, lines.length * 4 + 5);

        // Background
        doc.setFillColor(...bgColor);
        doc.roundedRect(margin, y - 4, insightW, boxH, 1.5, 1.5, "F");
        // Accent bar
        doc.setFillColor(...accentColor);
        doc.rect(margin, y - 4, 2, boxH, "F");
        // Icon circle
        doc.setFillColor(...accentColor);
        doc.circle(margin + 7, y + boxH / 2 - 4, 2.5, "F");
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(icon, margin + 7, y + boxH / 2 - 3.2, { align: "center" });
        // Text
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textColor);
        doc.text(lines, margin + 13, y);

        y += boxH + 2;
      });
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    }

    // Clients section
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Resumo por Cliente", margin, y);
    y += 7;

    const clientColWidths = [58, 16, 14, 16, 20, 22, 26];
    const clientHeaders = ["Cliente", "Ativid.", "Horas", "Meta", "Meta%", "Custo", "Custo/hora"];
    doc.setFillColor(30, 42, 94);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let x = margin + 2;
    clientHeaders.forEach((h, i) => { doc.text(h, x, y); x += clientColWidths[i]; });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    clientStats.forEach((c, idx) => {
      const costPerHour = c.hours > 0 ? c.cost / c.hours : 0;
      const row = [
        c.display_name, String(c.count), c.hours.toFixed(1) + "h",
        c.target > 0 ? String(c.target) : "-", c.pct !== null ? c.pct + "%" : "-",
        c.cost > 0 ? `R$ ${formatCurrency(c.cost)}` : "-", costPerHour > 0 ? `R$ ${formatCurrency(costPerHour)}` : "-",
      ];
      const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, clientColWidths[i] - 3));
      const maxLines = Math.max(...wrapped.map((l) => l.length), 1);
      const rowH = Math.max(7, maxLines * 3.5 + 3);
      if (y + rowH > 275) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 255); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
      doc.setTextColor(40, 40, 40);
      x = margin + 2;
      wrapped.forEach((lines, i) => { doc.text(lines, x, y); x += clientColWidths[i]; });
      y += rowH;
    });
    y += 6;

    // Employees section
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Resumo por Colaborador", margin, y);
    y += 7;

    const empColWidths = [60, 20, 20, 30, 30, 30];
    const empHeaders = ["Colaborador", "Ativid.", "Horas", "Custo", "Custo/hora", "Cargo"];
    doc.setFillColor(30, 42, 94);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    x = margin + 2;
    empHeaders.forEach((h, i) => { doc.text(h, x, y); x += empColWidths[i]; });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    employeeStats.forEach((emp, idx) => {
      const costPerHour = emp.hours > 0 ? emp.cost / emp.hours : 0;
      const row = [
        emp.name, String(emp.count), emp.hours.toFixed(1) + "h",
        emp.cost > 0 ? `R$ ${formatCurrency(emp.cost)}` : "-",
        costPerHour > 0 ? `R$ ${formatCurrency(costPerHour)}` : "-",
        emp.role || "-",
      ];
      const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, empColWidths[i] - 3));
      const maxLines = Math.max(...wrapped.map((l) => l.length), 1);
      const rowH = Math.max(7, maxLines * 3.5 + 3);
      if (y + rowH > 275) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 255); doc.rect(margin, y - 4, pageWidth - margin * 2, rowH, "F"); }
      doc.setTextColor(40, 40, 40);
      x = margin + 2;
      wrapped.forEach((lines, i) => { doc.text(lines, x, y); x += empColWidths[i]; });
      y += rowH;
    });
    y += 6;

    // Detailed Client section — hierarchical: company → group entries + branches
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Detalhamento por Cliente", margin, y);
    y += 7;

    // Build hierarchical structure for PDF
    const pdfHierarchy = {};
    entries.forEach((e) => {
      const parent = clients.find((c) => c.id === e.client_id);
      const companyName = parent?.company_name || e.client_name || "Sem Cliente";
      const companyKey = e.client_id || companyName;
      if (!pdfHierarchy[companyKey]) {
        pdfHierarchy[companyKey] = { companyName, groupEntries: [], branches: {} };
      }
      const { level, branchName } = classifyEntry(e);
      if (level === "branch" && branchName) {
        if (!pdfHierarchy[companyKey].branches[branchName]) pdfHierarchy[companyKey].branches[branchName] = [];
        pdfHierarchy[companyKey].branches[branchName].push(e);
      } else {
        pdfHierarchy[companyKey].groupEntries.push(e);
      }
    });

    const pdfSortedCompanies = Object.values(pdfHierarchy).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, 'pt-BR')
    );

    const detColWidths = [42, 30, 24, 22, 12, 22];
    const detHeaders = ["Atividade", "Data", "Horário", "Status", "Horas", "Custo"];

    // Helper: render employee-grouped entries for PDF
    const renderPdfEntryBlock = (blockEntries) => {
      const byEmp = {};
      blockEntries.forEach((e) => {
        const key = e.employee_id || "sem";
        if (!byEmp[key]) byEmp[key] = { employee_name: e.employee_name || "-", entries: [] };
        byEmp[key].entries.push(e);
      });
      const empGroups = Object.values(byEmp).sort((a, b) => a.employee_name.localeCompare(b.employee_name));

      empGroups.forEach((eg) => {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFillColor(240, 242, 255);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        const egHours = eg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
        doc.text(`${eg.employee_name}  (${eg.entries.length} ativ. · ${egHours.toFixed(1)}h)`, margin + 2, y);
        y += 6;

        doc.setFillColor(30, 42, 94);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        x = margin + 2;
        detHeaders.forEach((h, i) => { doc.text(h, x, y); x += detColWidths[i]; });
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        eg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e, idx) => {
          const sLabel = e.status === "realizado" ? "Realizado" : e.status === "cancelado" ? "Cancelado" : "Agendado";
          const empObj = employees.find((em) => em.id === e.employee_id);
          const cph = (empObj?.monthly_salary || 0) / 176;
          const eCost = e.status === "cancelado" ? 0 : calcHours(e.start_time, e.end_time) * cph;
          const row = [
            e.activity || "-",
            e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-",
            e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : "-",
            sLabel,
            calcHours(e.start_time, e.end_time).toFixed(1) + "h",
            eCost > 0 ? `R$ ${formatCurrency(eCost)}` : "-",
          ];
          const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, detColWidths[i] - 3));
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
            } else if (i === 5) { doc.setTextColor(107, 33, 168); }
            else { doc.setTextColor(40, 40, 40); }
            doc.text(lines, x, y);
            x += detColWidths[i];
          });
          y += rowH;
        });
        y += 3;
      });
    };

    pdfSortedCompanies.forEach((company) => {
      if (y > 250) { doc.addPage(); y = 20; }
      const allEntries = [...company.groupEntries, ...Object.values(company.branches).flat()];
      const totalHrs = allEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
      const branchNames = Object.keys(company.branches).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const hasBranches = branchNames.length > 0;

      // Company header
      doc.setFillColor(220, 228, 255);
      doc.rect(margin, y - 6, pageWidth - margin * 2, 10, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 42, 94);
      doc.text(`${company.companyName}  |  ${allEntries.length} atividades  |  ${totalHrs.toFixed(1)}h`, margin + 2, y);
      y += 8;

      // Group-level entries
      if (company.groupEntries.length > 0) {
        if (hasBranches) {
          if (y > 260) { doc.addPage(); y = 20; }
          const grpHrs = company.groupEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(80, 80, 100);
          doc.text(`GRUPO — ${company.groupEntries.length} ativ. · ${grpHrs.toFixed(1)}h`, margin + 2, y);
          y += 5;
        }
        renderPdfEntryBlock(company.groupEntries);
        y += 2;
      }

      // Branch entries
      branchNames.forEach((branchName) => {
        const branchEntries = company.branches[branchName];
        const branchHrs = branchEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFillColor(230, 235, 255);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 50, 80);
        doc.text(`${company.companyName} — ${branchName}  |  ${branchEntries.length} ativ.  |  ${branchHrs.toFixed(1)}h`, margin + 2, y);
        y += 6;
        renderPdfEntryBlock(branchEntries);
        y += 2;
      });

      y += 5;
    });
    y += 6;

    // Detailed Employee section
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    doc.text("Detalhamento por Colaborador", margin, y);
    y += 7;

    employeeStats.forEach((emp) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(230, 235, 255);
      doc.rect(margin, y - 6, pageWidth - margin * 2, 10, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 42, 94);
      doc.text(`${emp.name}  |  ${emp.role || ""}  |  ${emp.count} atividades  |  ${emp.hours.toFixed(1)}h`, margin + 2, y);
      y += 8;

      const detColWidths2 = [42, 30, 24, 22, 12, 22];
      const detHeaders2 = ["Atividade", "Data", "Horário", "Status", "Horas", "Custo"];

      emp.clientGroups.forEach((cg) => {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFillColor(240, 242, 255);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        const cgHours = cg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
        const cgDisplayName = buildClientDisplayName(cg.entries[0]?.client_name, cg.entries[0]?.client_id, clients);
        doc.text(`${cgDisplayName}  (${cg.entries.length} ativ. · ${cgHours.toFixed(1)}h)`, margin + 2, y);
        y += 6;

        doc.setFillColor(30, 42, 94);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        x = margin + 2;
        detHeaders2.forEach((h, i) => { doc.text(h, x, y); x += detColWidths2[i]; });
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        cg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e, idx) => {
          const sLabel = e.status === "realizado" ? "Realizado" : e.status === "cancelado" ? "Cancelado" : "Agendado";
          const cph2 = (emp.monthly_salary || 0) / 176;
          const eCost2 = e.status === "cancelado" ? 0 : calcHours(e.start_time, e.end_time) * cph2;
          const row = [
            e.activity || "-",
            e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-",
            e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : "-",
            sLabel,
            calcHours(e.start_time, e.end_time).toFixed(1) + "h",
            eCost2 > 0 ? `R$ ${formatCurrency(eCost2)}` : "-",
          ];
          const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, detColWidths2[i] - 3));
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
            } else if (i === 5) { doc.setTextColor(107, 33, 168); }
            else { doc.setTextColor(40, 40, 40); }
            doc.text(lines, x, y);
            x += detColWidths2[i];
          });
          y += rowH;
        });
        y += 3;
      });
      y += 5;
    });

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: "center" });
      doc.text("Varejarte Agenda — Consolidado", pageWidth - margin, 290, { align: "right" });
    }

    doc.save(`Varejarte Consultoria - relatorio_varejarte_consolidado_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [entries, clients, employees, periodLabel, clientStats, employeeStats, insights, totalHours, realized, cancelled, totalCost, avgCostPerActivity, totalRevenue, byActivity, statusData]);

  React.useImperativeHandle(ref, () => ({ handleExportPDF }), [handleExportPDF]);

  const hasCostData = employeeStats.some((e) => e.cost > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img src="/brand/varejarte-branco.png" alt="Varejarte" style={{ height: 30 }} />
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#1e3480' }}>
          <Zap className="w-5 h-5" style={{ color: '#1e3480' }} /> Consolidado Varejarte
        </h2>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-2 gap-2.5 ${totalRevenue > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <Card><CardContent className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Activity className="w-4 h-4 text-primary" /></div>
            <div className="min-w-0"><p className="text-lg font-bold leading-tight">{entries.length}</p><p className="text-[10px] text-muted-foreground truncate">Atividades</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div className="min-w-0"><p className="text-lg font-bold leading-tight">{totalHours.toFixed(1)}h</p><p className="text-[10px] text-muted-foreground truncate">Horas totais</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
            <div className="min-w-0"><p className="text-lg font-bold leading-tight">{entries.length > 0 ? Math.round((realized / entries.length) * 100) : 0}%</p><p className="text-[10px] text-muted-foreground truncate">Realização</p></div>
          </div>
        </CardContent></Card>
        {hasCostData ? (
          <Card><CardContent className="px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-purple-600" /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-tight truncate">R$ {formatCurrency(totalCost)}</p><p className="text-[10px] text-muted-foreground truncate">Custo estimado</p></div>
            </div>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-tight">{cancelled}</p><p className="text-[10px] text-muted-foreground truncate">Cancelamentos</p></div>
            </div>
          </CardContent></Card>
        )}
        {totalRevenue > 0 && (
          <Card><CardContent className="px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight truncate">R$ {formatCurrency(totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground truncate">Faturamento</p>
                {hasCostData && totalCost > 0 && (
                  <p className="text-[10px] font-medium text-emerald-600 truncate">Margem: R$ {formatCurrency(totalRevenue - totalCost)}</p>
                )}
              </div>
            </div>
          </CardContent></Card>
        )}
      </div>

      {/* Charts */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-amber-600" /> Atividades por Tipo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byActivity} margin={{ top: 0, right: 10, left: -20, bottom: 30 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Atividades" radius={[4, 4, 0, 0]}>
                    {byActivity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Atividades por Colaborador</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={employeeStats.map((e) => ({ name: e.name.split(" ")[0], count: e.count }))} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Atividades" radius={[4, 4, 0, 0]}>
                    {employeeStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Status das Atividades</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="name" cx="45%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-bold text-blue-600 mb-4">Insights & Análises (últimos 30 dias)</h3>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-muted-foreground font-medium">
                    {ins.type === "success" ? "✓" : ins.type === "warning" ? "!" : "→"}
                  </span>
                  {" " + ins.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client table with cost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" /> Resumo por Cliente
            {hasCostData && <span className="text-xs font-normal text-muted-foreground ml-2">(inclui métricas de custo)</span>}
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
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Meta</th>
                  {hasCostData && <>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Custo Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Custo/Hora</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {clientStats.map((c, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{c.display_name}</td>
                    <td className="px-4 py-3 text-right">{c.count}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.hours.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right">
                      {c.target > 0 ? (
                        <span className={`text-xs font-semibold ${c.pct >= 100 ? "text-emerald-600" : c.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {c.count}/{c.target} ({c.pct}%)
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    {hasCostData && <>
                      <td className="px-4 py-3 text-right font-mono text-purple-700 font-medium">
                        {c.cost > 0 ? `R$ ${formatCurrency(c.cost)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                        {c.cost > 0 && c.hours > 0 ? `R$ ${formatCurrency(c.cost / c.hours)}/h` : "—"}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Client Details - hierarchical: company → group entries + branches */}
      {entries.length > 0 && (() => {
        // Build hierarchical structure: company → { groupEntries, branches: { branchName → entries } }
        const hierarchy = {};
        entries.forEach((e) => {
          const parent = clients.find((c) => c.id === e.client_id);
          const companyName = parent?.company_name || e.client_name || "Sem Cliente";
          const companyKey = e.client_id || companyName;
          if (!hierarchy[companyKey]) {
            hierarchy[companyKey] = { companyName, client_id: e.client_id, groupEntries: [], branches: {} };
          }
          const { level, branchName } = classifyEntry(e);
          if (level === "branch" && branchName) {
            if (!hierarchy[companyKey].branches[branchName]) hierarchy[companyKey].branches[branchName] = [];
            hierarchy[companyKey].branches[branchName].push(e);
          } else {
            hierarchy[companyKey].groupEntries.push(e);
          }
        });

        const sortedCompanies = Object.values(hierarchy).sort((a, b) =>
          a.companyName.localeCompare(b.companyName, 'pt-BR')
        );

        const renderEntryTable = (entryList) => {
          const byEmp = {};
          entryList.forEach((e) => {
            const key = e.employee_id || "sem";
            if (!byEmp[key]) byEmp[key] = { employee_name: e.employee_name || "Sem Colaborador", employee_color: e.employee_color, entries: [] };
            byEmp[key].entries.push(e);
          });
          return Object.values(byEmp).sort((a, b) => a.employee_name.localeCompare(b.employee_name)).map((eg, ei) => {
            const egHours = eg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
            return (
              <div key={ei}>
                <div className="flex items-center justify-between px-4 py-2 bg-accent/30">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: eg.employee_color || "#6366f1" }}>
                      {eg.employee_name?.charAt(0)}
                    </div>
                    <p className="text-sm font-medium">{eg.employee_name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{eg.entries.length} ativ.</span>
                    <span>{egHours.toFixed(1)}h</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '14%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Atividade</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Data</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Horário</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Status</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((e, i) => {
                        const h = calcHours(e.start_time, e.end_time);
                        return (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2 break-words">{e.activity || "-"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "-"}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.status === "realizado" ? "bg-emerald-100 text-emerald-700" : e.status === "cancelado" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                {e.status === "realizado" ? "Realizado" : e.status === "cancelado" ? "Cancelado" : "Agendado"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono">{h.toFixed(1)}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          });
        };

        return (
          <>
            <div className="mt-6 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Detalhamento por Cliente</h3>
            </div>
            {sortedCompanies.map((company) => {
              const allCompanyEntries = [...company.groupEntries, ...Object.values(company.branches).flat()];
              const totalHrs = allCompanyEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
              const branchNames = Object.keys(company.branches).sort((a, b) => a.localeCompare(b, 'pt-BR'));
              const hasBranches = branchNames.length > 0;

              return (
                <Card key={company.client_id || company.companyName}>
                  {/* Company header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">{company.companyName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{allCompanyEntries.length}</strong> atividades</span>
                      <span><strong className="text-foreground">{totalHrs.toFixed(1)}h</strong></span>
                    </div>
                  </div>
                  <CardContent className="p-0 divide-y divide-border">
                    {/* Group-level entries (only for the company, no branch) */}
                    {company.groupEntries.length > 0 && (
                      <div>
                        {hasBranches && (
                          <div className="px-4 py-1.5 bg-muted/30 border-b border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Grupo — {company.groupEntries.length} ativ. · {company.groupEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0).toFixed(1)}h
                            </p>
                          </div>
                        )}
                        {renderEntryTable(company.groupEntries)}
                      </div>
                    )}
                    {/* Branch-level entries */}
                    {branchNames.map((branchName) => {
                      const branchEntries = company.branches[branchName];
                      const branchHrs = branchEntries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
                      return (
                        <div key={branchName}>
                          <div className="px-4 py-2 bg-muted/20 border-b border-border flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">{company.companyName} — {branchName}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{branchEntries.length} ativ.</span>
                              <span>{branchHrs.toFixed(1)}h</span>
                            </div>
                          </div>
                          {renderEntryTable(branchEntries)}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </>
        );
      })()}

      {/* Employee table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Resumo por Colaborador
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
                  {hasCostData && <>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Custo Alocado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Custo/Hora</th>
                  </>}
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
                    {hasCostData && <>
                      <td className="px-4 py-3 text-right font-mono text-purple-700 font-medium">
                        {emp.cost > 0 ? `R$ ${formatCurrency(emp.cost)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                        {emp.cost > 0 && emp.hours > 0 ? `R$ ${formatCurrency(emp.cost / emp.hours)}/h` : "—"}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Details - grouped by client */}
      {employeeStats.length > 0 && (
        <>
          <div className="mt-6 mb-2">
            <h3 className="text-sm font-semibold text-foreground">Detalhamento por Colaborador</h3>
          </div>
          {employeeStats.map((employee) => (
            <Card key={employee.id}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: employee.color || "#6366f1" }}>
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.role || ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{employee.count}</strong> atividades</span>
                  <span><strong className="text-foreground">{employee.hours.toFixed(1)}h</strong></span>
                </div>
              </div>
              <CardContent className="p-0 divide-y divide-border">
                {employee.clientGroups.map((cg, ci) => {
                  const cgHours = cg.entries.reduce((a, e) => a + calcHours(e.start_time, e.end_time), 0);
                  return (
                    <div key={ci}>
                      <div className="flex items-center justify-between px-4 py-2 bg-accent/30">
                        <p className="text-sm font-semibold">{cg.display_name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{cg.entries.length} atividades</span>
                          <span>{cgHours.toFixed(1)}h</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-fixed">
                          <colgroup>
                            <col style={{ width: '35%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '14%' }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Atividade</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Data</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Horário</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Status</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Horas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cg.entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((e, i) => {
                              const h = calcHours(e.start_time, e.end_time);
                              return (
                                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                                  <td className="px-4 py-2 break-words">{e.activity || "-"}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{e.date ? format(parseISO(e.date), "dd/MM/yyyy") : "-"}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "-"}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.status === "realizado" ? "bg-emerald-100 text-emerald-700" : e.status === "cancelado" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                      {e.status === "realizado" ? "Realizado" : e.status === "cancelado" ? "Cancelado" : "Agendado"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono">{h.toFixed(1)}h</td>
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
                <span className="text-xs text-muted-foreground font-medium">Total {employee.name}</span>
                <span className="font-mono font-bold text-sm">{employee.hours.toFixed(1)}h</span>
              </div>
            </Card>
          ))}
        </>
      )}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma atividade encontrada para o período selecionado.
          </CardContent>
        </Card>
      )}
    </div>
  );
});

ReportVarejarteComponent.displayName = "ReportVarejarte";

export default ReportVarejarteComponent;