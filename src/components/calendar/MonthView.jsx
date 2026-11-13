import React from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

function hasConflict(dayEntries) {
  const active = dayEntries.filter(e => e.status !== "cancelado");
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (active[i].employee_id === active[j].employee_id &&
          active[i].start_time < active[j].end_time &&
          active[j].start_time < active[i].end_time) return true;
    }
  }
  return false;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function MonthView({ currentDate, entries, onDayClick, isViewer }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEntriesForDay = (day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return entries.filter((e) => e.date === dateStr).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEntries = getEntriesForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[100px] p-1.5 border-b border-r border-border cursor-pointer transition-colors hover:bg-accent/50 h-auto",
                !inMonth && "bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    today && "bg-primary text-primary-foreground",
                    !inMonth && "text-muted-foreground/50",
                    inMonth && !today && "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEntries.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    {hasConflict(dayEntries) && (
                      <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-100 text-amber-600" title="Conflito de horário">
                        <AlertTriangle className="w-2 h-2" />
                      </span>
                    )}
                    {dayEntries.length}
                  </span>
                )}
              </div>
              {inMonth && (
                <div className="space-y-0.5">
                  {dayEntries.map((entry, i) => {
                    const fullName = entry.client_name || "";
                    const displayName = fullName.includes("—") ? fullName.split("—").slice(1).join("—").trim() : fullName;
                    
                    return (
                      <div
                        key={i}
                        className="text-[10px] leading-tight px-1.5 py-0.5 rounded text-white font-medium"
                        style={{ backgroundColor: entry.employee_color || "#6366f1" }}
                        title={isViewer ? `${fullName} - ${entry.activity}` : `${entry.employee_name} - ${fullName} - ${entry.activity}`}
                      >
                        <span className="block break-words">{entry.start_time} {isViewer ? "" : `${entry.employee_name?.split(" ")[0]} – `}{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}