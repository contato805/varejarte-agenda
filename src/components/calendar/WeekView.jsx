import React, { useState } from "react";
import { startOfWeek, endOfWeek, addDays, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h–19h
const ROW_H = 56; // px per hour row

export default function WeekView({ currentDate, entries, onPrev, onNext, onToday }) {
  const [popup, setPopup] = useState(null); // { day, hour, entries }

  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${format(weekStart, "dd MMM", { locale: ptBR })} — ${format(weekEnd, "dd MMM yyyy", { locale: ptBR })}`;

  const getEntriesForDay = (day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return entries.filter((e) => e.date === dateStr);
  };

  const toMinutes = (time) => {
    const [h, m] = (time || "08:00").split(":").map(Number);
    return h * 60 + m;
  };

  // Group entries by which hour slot they START in
  const groupByHour = (dayEntries) => {
    const groups = {};
    dayEntries.forEach((entry) => {
      const hour = Math.floor(toMinutes(entry.start_time) / 60);
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(entry);
    });
    return groups;
  };

  const MAX_SHOW = 3; // max entries shown per hour cell

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={onToday} className="h-7 text-xs px-2">
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Hoje
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
        <div className="p-1" />
        {weekDays.map((day, i) => (
          <div key={i} className="py-1.5 text-center border-l border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {format(day, "EEE", { locale: ptBR })}
            </div>
            <div
              className={cn(
                "text-base font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full mx-auto",
                isToday(day) && "bg-primary text-primary-foreground"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid — slot-based layout */}
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              {/* Hour label */}
              <div
                style={{ height: `${ROW_H}px` }}
                className="flex items-start justify-end pr-1.5 pt-0.5 border-b border-border/40"
              >
                <span className="text-[10px] text-muted-foreground leading-none">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>

              {/* Day cells for this hour */}
              {weekDays.map((day, dayIdx) => {
                const dayEntries = getEntriesForDay(day);
                const grouped = groupByHour(dayEntries);
                const hourEntries = grouped[hour] || [];
                const visible = hourEntries.slice(0, MAX_SHOW);
                const extra = hourEntries.length - MAX_SHOW;

                return (
                  <div
                    key={dayIdx}
                    style={{ height: `${ROW_H}px` }}
                    className="border-l border-b border-border/40 p-0.5 overflow-hidden"
                  >
                    <div className="flex flex-col gap-[1px] h-full">
                      {visible.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-0.5 rounded px-1 py-[1px] min-h-[14px] cursor-pointer hover:brightness-110 transition-all truncate"
                          style={{ backgroundColor: entry.employee_color || "#6366f1" }}
                          title={`${entry.employee_name} — ${entry.start_time}-${entry.end_time}\n${entry.activity}\n${entry.client_name}`}
                        >
                          <span className="text-[8px] font-bold text-white truncate leading-tight">
                            {entry.employee_name?.split(" ")[0]?.charAt(0)}.
                          </span>
                          <span className="text-[7px] text-white/80 truncate leading-tight">
                            {entry.client_name?.split(" ").slice(0, 2).join(" ")}
                          </span>
                        </div>
                      ))}
                      {extra > 0 && (
                        <button
                          onClick={() => setPopup({ day: format(day, "dd/MM"), hour, entries: hourEntries })}
                          className="text-[8px] font-bold text-primary hover:underline text-left pl-1"
                        >
                          +{extra} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Popup for overflow entries */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setPopup(null)}>
          <div
            className="bg-card rounded-xl border border-border shadow-xl p-4 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {popup.day} às {String(popup.hour).padStart(2, "0")}:00
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPopup(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {popup.entries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ backgroundColor: `${entry.employee_color || "#6366f1"}20`, borderLeft: `3px solid ${entry.employee_color || "#6366f1"}` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{entry.employee_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {entry.start_time}–{entry.end_time} · {entry.activity} · {entry.client_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}