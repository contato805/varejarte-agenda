import React from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const PERIODS = [
  { key: "month", label: "Este Mês" },
  { key: "last_month", label: "Mês Passado" },
  { key: "week", label: "Esta Semana" },
  { key: "next_week", label: "Próxima Semana" },
  { key: "custom", label: "Personalizado" },
];

export function getPeriodRange(period, customStart, customEnd) {
  const now = new Date();
  if (period === "month") {
    return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
  }
  if (period === "week") {
    return { start: format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd") };
  }
  if (period === "last_month") {
    const m = subMonths(now, 1);
    return { start: format(startOfMonth(m), "yyyy-MM-dd"), end: format(endOfMonth(m), "yyyy-MM-dd") };
  }
  if (period === "next_week") {
    const w = addWeeks(now, 1);
    return { start: format(startOfWeek(w, { weekStartsOn: 0 }), "yyyy-MM-dd"), end: format(endOfWeek(w, { weekStartsOn: 0 }), "yyyy-MM-dd") };
  }
  if (period === "custom") {
    return { start: customStart, end: customEnd };
  }
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
}

export default function DashboardFilter({ period, onPeriodChange, customStart, customEnd, onCustomChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="w-4 h-4" />
        <span className="text-xs font-medium">Período:</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPeriodChange(p.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              period === p.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="h-8 text-xs w-[140px]"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="h-8 text-xs w-[140px]"
          />
        </div>
      )}
    </div>
  );
}