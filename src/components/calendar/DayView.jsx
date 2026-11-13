import React, { useState } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadDayPDF, downloadWeekPDF } from "@/utils/dayPdf";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h–19h
const ROW_H = 64;

export default function DayView({ currentDate, entries, onPrev, onNext, onToday }) {
  const [popup, setPopup] = useState(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");
  const dayEntries = entries.filter((e) => e.date === dateStr);
  const dayLabel = format(currentDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });

  const toMinutes = (time) => {
    const [h, m] = (time || "08:00").split(":").map(Number);
    return h * 60 + m;
  };

  const groupByHour = (list) => {
    const groups = {};
    list.forEach((entry) => {
      const hour = Math.floor(toMinutes(entry.start_time) / 60);
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(entry);
    });
    return groups;
  };

  const grouped = groupByHour(dayEntries);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Day navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">{dayLabel}</span>
          {isToday(currentDate) && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">Hoje</span>
          )}
          {!isToday(currentDate) && (
            <Button variant="outline" size="sm" onClick={onToday} className="h-7 text-xs px-2">
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              Hoje
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => downloadDayPDF(currentDate, entries)}
            title="Baixar PDF do dia"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dia</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => downloadWeekPDF(currentDate, entries)}
            title="Baixar PDF da semana (7 dias)"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Semana</span>
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Hour rows */}
      <div className="overflow-y-auto max-h-[70vh]">
        {HOURS.map((hour) => {
          const hourEntries = grouped[hour] || [];
          return (
            <div key={hour} className="flex border-b border-border/40" style={{ minHeight: `${ROW_H}px` }}>
              {/* Hour label */}
              <div className="w-14 shrink-0 flex items-start justify-end pr-2 pt-1 border-r border-border/40">
                <span className="text-xs text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
              </div>
              {/* Entries */}
              <div className="flex-1 p-1 flex flex-col gap-1">
                {hourEntries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-default"
                    style={{
                      backgroundColor: `${entry.employee_color || "#6366f1"}15`,
                      borderLeft: `3px solid ${entry.employee_color || "#6366f1"}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: entry.employee_color || "#6366f1" }}
                    >
                      {entry.employee_name?.charAt(0)}
                    </div>
                    <span className="text-xs font-medium truncate max-w-[80px] shrink-0">{entry.employee_name}</span>
                    <span className="text-[10px] text-muted-foreground w-[90px] shrink-0">{entry.start_time}–{entry.end_time}</span>
                    <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-[100px]">{entry.activity}</span>
                    <span className="text-[10px] font-medium text-foreground truncate max-w-[160px] shrink-0 text-right">
                      {entry.client_name?.includes("—") ? entry.client_name.split("—").slice(1).join("—").trim() : entry.client_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}