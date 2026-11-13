import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";

export default function ActivityChart({ entries }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const todayEntries = (entries || [])
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const tomorrowEntries = (entries || [])
    .filter((e) => e.date === tomorrow)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const DaySection = ({ label, dayEntries, accent }) => (
    <div>
      <div className={`flex items-center gap-2 mb-2`}>
        <CalendarDays className={`w-3.5 h-3.5 ${accent}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{label}</span>
        <span className="text-xs text-muted-foreground">({dayEntries.length})</span>
      </div>
      {dayEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic pl-5">Nenhuma atividade</p>
      ) : (
        <div className="space-y-1.5 pl-1">
          {dayEntries.map((e, i) => (
            <div key={i} className="grid grid-cols-[4rem_1fr_1fr_1fr] items-center gap-2 text-xs rounded-lg border border-border bg-muted/20 px-3 py-2">
              <span className="flex items-center gap-1 text-muted-foreground font-mono whitespace-nowrap">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {e.start_time}
              </span>
              <span className="text-muted-foreground truncate">{e.client_name}</span>
              <div className="flex items-center gap-1 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.employee_color || "#6366f1" }} />
                <span className="truncate text-muted-foreground">{e.employee_name}</span>
              </div>
              <span className="font-medium truncate">{e.activity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Atividades Previstas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <DaySection
          label={`Hoje — ${format(new Date(), "dd/MM", { locale: ptBR })}`}
          dayEntries={todayEntries}
          accent="text-primary"
        />
        <DaySection
          label={`Amanhã — ${format(addDays(new Date(), 1), "dd/MM", { locale: ptBR })}`}
          dayEntries={tomorrowEntries}
          accent="text-muted-foreground"
        />
      </CardContent>
    </Card>
  );
}