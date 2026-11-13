import jsPDF from "jspdf";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Palette: deterministic color per string key
const PALETTE = [
  [59, 130, 246],   // blue
  [16, 185, 129],   // green
  [245, 158, 11],   // amber
  [239, 68, 68],    // red
  [139, 92, 246],   // purple
  [6, 182, 212],    // cyan
  [249, 115, 22],   // orange
  [132, 204, 22],   // lime
  [236, 72, 153],   // pink
  [20, 184, 166],   // teal
];

function colorForKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  return PALETTE[hash % PALETTE.length];
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function colorForActivity(activityName) {
  return colorForKey(activityName || "outro");
}

/**
 * Generate a monthly grid PDF (landscape A4).
 * @param {object[]} entries - filtered ScheduleEntry records
 * @param {Date} currentDate - any date in the target month
 * @param {"client"|"employee"} groupBy - label context
 * @param {string} groupLabel - e.g. client name or employee name
 */
export async function downloadAgendaPDF(entries, currentDate, groupBy, groupLabel) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const margin = 10;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  // expand to full weeks
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const monthLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  const groupTypeLabel = groupBy === "client" ? "Cliente" : "Colaborador";

  // ── Header ──────────────────────────────────────────────────────
  doc.setFillColor(30, 42, 94);
  doc.rect(0, 0, W, 26, "F");

  // Logo image
  const logoUrl = "/brand/varejarte-branco.png";
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = logoUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const logoH = 27.5;
    const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
    doc.addImage(dataUrl, "PNG", margin, 2, logoW, logoH);
  } catch (_) {
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Varejarte", margin, 28);
  }

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(`${groupTypeLabel}: ${groupLabel}  |  ${monthLabel}`, W / 2, 16, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, W - margin, 16, { align: "right" });

  // ── Week rows ────────────────────────────────────────────────────
  const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const startY = 28;
  const colW = (W - margin * 2) / 7;
  const headerH = 7;
  const blockH = 8;
  const blockSpacing = 1.5;
  const cellPaddingTop = 6.5;
  const minRowH = 28;

  // Build date→entries map (only days within the target month)
  const entryMap = {};
  entries.forEach((e) => {
    if (!e.date) return;
    if (e.date < format(monthStart, "yyyy-MM-dd") || e.date > format(monthEnd, "yyyy-MM-dd")) return;
    (entryMap[e.date] = entryMap[e.date] || []).push(e);
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // Calculate required height for each week row based on max entries per day
  const rowHeights = weeks.map((week) => {
    const maxEntries = Math.max(
      ...week.map((day) => (entryMap[format(day, "yyyy-MM-dd")] || []).length),
      0
    );
    const needed = cellPaddingTop + maxEntries * (blockH + blockSpacing) + 2;
    return Math.max(minRowH, needed);
  });

  const legendH = 8; // reserve space for legend at bottom
  const maxPageY = H - legendH;

  // Helper: draw day-of-week header row
  function drawWeekDayHeader(y) {
    doc.setFillColor(237, 242, 255);
    doc.rect(margin, y, W - margin * 2, headerH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 42, 94);
    WEEK_DAYS.forEach((d, i) => {
      doc.text(d, margin + i * colW + colW / 2, y + 4.5, { align: "center" });
    });
  }

  // Helper: draw legend on current page
  function drawLegend() {
    const actTypes = [...new Set(entries.map(e => e.activity).filter(Boolean))];
    if (actTypes.length === 0) return;
    let lx = margin;
    const ly = H - 3;
    doc.setFontSize(5.5);
    actTypes.slice(0, 12).forEach((act) => {
      const [r, g, b] = colorForActivity(act);
      doc.setFillColor(r, g, b);
      doc.rect(lx, ly - 2.5, 3, 2.5, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(act, lx + 4, ly - 0.5);
      lx += doc.getTextWidth(act) + 10;
    });
  }

  // Helper: draw a week row
  function drawWeekRow(week, rowH, rowY) {
    week.forEach((day, di) => {
      const cellX = margin + di * colW;
      const dateStr = format(day, "yyyy-MM-dd");
      const inMonth = day >= monthStart && day <= monthEnd;

      if (dateStr === today) {
        doc.setFillColor(219, 234, 254);
      } else if (!inMonth) {
        doc.setFillColor(248, 249, 250);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(cellX, rowY, colW, rowH, "F");

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.rect(cellX, rowY, colW, rowH, "S");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", inMonth ? "bold" : "normal");
      doc.setTextColor(inMonth ? 30 : 160, inMonth ? 42 : 160, inMonth ? 94 : 160);
      doc.text(format(day, "d"), cellX + 2, rowY + 5);

      const dayEntries = (entryMap[dateStr] || []).sort((a, b) =>
        (a.start_time || "").localeCompare(b.start_time || "")
      );

      dayEntries.forEach((e, ei) => {
        const [r, g, b] = colorForActivity(e.activity);
        const bY = rowY + cellPaddingTop + ei * (blockH + blockSpacing);
        doc.setFillColor(Math.min(255, r + 140), Math.min(255, g + 140), Math.min(255, b + 140));
        doc.roundedRect(cellX + 1, bY, colW - 2, blockH, 0.8, 0.8, "F");
        doc.setFillColor(r, g, b);
        doc.rect(cellX + 1, bY, 1.5, blockH, "F");
        const maxW = colW - 6;
        // Top line: client name (bold)
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(Math.max(0, r - 60), Math.max(0, g - 60), Math.max(0, b - 60));
        const topLabel = groupBy === "employee" ? (e.client_name || "-") : (e.activity || "-");
        const labelLines = doc.splitTextToSize(topLabel, maxW);
        doc.text(labelLines, cellX + 4, bY + 2.8);
        // Bottom line: time + activity/employee
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        const subDetail = groupBy === "employee"
          ? (e.activity ? " · " + e.activity : "")
          : (e.employee_name ? " · " + e.employee_name : "");
        const sub = `${e.start_time || ""}${subDetail}`;
        const subLines = doc.splitTextToSize(sub, maxW);
        const subY = bY + 2.8 + labelLines.length * 2.2;
        doc.text(subLines, cellX + 4, subY);
      });
    });
  }

  // Draw first header
  drawWeekDayHeader(startY);
  let currentY = startY + headerH;

  weeks.forEach((week, wi) => {
    const rowH = rowHeights[wi];

    // Check if this row fits on the current page
    if (currentY + rowH > maxPageY) {
      drawLegend();
      doc.addPage();
      // Draw week-day header on new page
      drawWeekDayHeader(margin);
      currentY = margin + headerH;
    }

    drawWeekRow(week, rowH, currentY);
    currentY += rowH;
  });

  // Draw legend on the last page
  drawLegend();

  const safeName = groupLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`Varejarte Consultoria - agenda_${groupBy}_${safeName}_${format(currentDate, "yyyy-MM")}.pdf`);
}