import { jsPDF } from "jspdf";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// Table column positions (mm)
const COL = {
  hora:       { x: 10,  w: 18 },
  colaborador:{ x: 28,  w: 30 },
  horario:    { x: 58,  w: 24 },
  atividade:  { x: 82,  w: 55 },
  cliente:    { x: 137, w: 63 },
};
const TABLE_LEFT = 10;
const TABLE_RIGHT = 200;
const ROW_PAD = 2;
const FONT_SIZE = 7;
const HEADER_H = 7;
const PAGE_H = 280;

function wrapText(doc, text, maxW) {
  return doc.splitTextToSize(text || "", maxW);
}

function drawTableHeader(doc, y) {
  doc.setFillColor(240, 240, 245);
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, HEADER_H, "F");
  doc.setDrawColor(180);
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, HEADER_H, "S");

  doc.setFontSize(FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);

  const ty = y + 5;
  doc.text("Hora",        COL.hora.x + 2,        ty);
  doc.text("Colaborador", COL.colaborador.x + 2,  ty);
  doc.text("Horário",     COL.horario.x + 2,      ty);
  doc.text("Atividade",   COL.atividade.x + 2,    ty);
  doc.text("Cliente",     COL.cliente.x + 2,       ty);

  // vertical lines
  Object.values(COL).forEach((c) => {
    doc.line(c.x, y, c.x, y + HEADER_H);
  });
  doc.line(TABLE_RIGHT, y, TABLE_RIGHT, y + HEADER_H);

  return y + HEADER_H;
}

function drawDayPage(doc, date, entries, isFirstPage) {
  if (!isFirstPage) doc.addPage();

  const dateStr = format(date, "yyyy-MM-dd");
  const dayEntries = entries
    .filter((e) => e.date === dateStr)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const dayLabel = format(date, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });

  // Header
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), 105, 14, { align: "center" });

  let y = 20;

  if (dayEntries.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120);
    doc.text("Sem atividades agendadas", 105, y + 10, { align: "center" });
    return;
  }

  y = drawTableHeader(doc, y);

  let lastHour = null;

  dayEntries.forEach((entry, idx) => {
    const hour = parseInt((entry.start_time || "08:00").split(":")[0], 10);
    const hourLabel = hour !== lastHour ? `${String(hour).padStart(2, "0")}:00` : "";
    lastHour = hour;

    // Calculate row height based on wrapped text
    doc.setFontSize(FONT_SIZE);
    doc.setFont("helvetica", "normal");
    const actLines = wrapText(doc, entry.activity || "", COL.atividade.w - 4);
    const cliLines = wrapText(doc, entry.client_name || "", COL.cliente.w - 4);
    const nameLines = wrapText(doc, entry.employee_name || "", COL.colaborador.w - 6);
    const maxLines = Math.max(actLines.length, cliLines.length, nameLines.length, 1);
    const rowH = Math.max(6, maxLines * 3.5 + ROW_PAD * 2);

    // New page if needed
    if (y + rowH > PAGE_H) {
      doc.addPage();
      y = 10;
      y = drawTableHeader(doc, y);
    }

    // Zebra striping
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, rowH, "F");
    }

    // Row border
    doc.setDrawColor(210);
    doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, rowH, "S");

    // Vertical column lines
    Object.values(COL).forEach((c) => {
      doc.line(c.x, y, c.x, y + rowH);
    });
    doc.line(TABLE_RIGHT, y, TABLE_RIGHT, y + rowH);

    const textY = y + ROW_PAD + 3;

    // Hour
    if (hourLabel) {
      doc.setFontSize(FONT_SIZE);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(hourLabel, COL.hora.x + 2, textY);
    }

    // Employee color dot + name
    const color = entry.employee_color || "#6366f1";
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    doc.circle(COL.colaborador.x + 3, textY - 1, 1.3, "F");

    doc.setFontSize(FONT_SIZE);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(nameLines, COL.colaborador.x + 6, textY);

    // Time range
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`${entry.start_time || ""}–${entry.end_time || ""}`, COL.horario.x + 2, textY);

    // Activity (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.text(actLines, COL.atividade.x + 2, textY);

    // Client (wrapped)
    doc.setTextColor(60);
    doc.text(cliLines, COL.cliente.x + 2, textY);

    y += rowH;
  });

}

export function downloadDayPDF(date, entries) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawDayPage(doc, date, entries, true);
  const name = format(date, "yyyy-MM-dd");
  doc.save(`Varejarte Consultoria - agenda-${name}.pdf`);
}

export function downloadWeekPDF(date, entries) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const weekStart = startOfWeek(date, { locale: ptBR });

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    drawDayPage(doc, day, entries, i === 0);
  }

  const start = format(weekStart, "dd-MM");
  const end = format(addDays(weekStart, 6), "dd-MM-yyyy");
  doc.save(`Varejarte Consultoria - agenda-semana-${start}-a-${end}.pdf`);
}