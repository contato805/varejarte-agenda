import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle, Bell } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function DashboardAlerts({ entries, employees, clients, allEntries }) {
  const alerts = useMemo(() => {
    const list = [];
    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

    // Entries do mês atual (não canceladas)
    const currentMonthEntries = allEntries.filter(
      (e) => e.date >= monthStart && e.date <= monthEnd && e.status !== "cancelado"
    );

    clients.forEach((client) => {
      if (client.active === false) return;

      // Atividades mensais previstas (geral do cliente + de cada filial)
      const planned = [];
      (client.monthly_activities || []).forEach((a) => {
        if (a.activity_type && a.quantity > 0) {
          planned.push({ type: a.activity_type, qty: a.quantity, branch: null });
        }
      });
      (client.branches || []).forEach((branch) => {
        if (branch.active === false) return;
        (branch.monthly_activities || []).forEach((a) => {
          if (a.activity_type && a.quantity > 0) {
            planned.push({ type: a.activity_type, qty: a.quantity, branch: branch.name });
          }
        });
      });

      if (planned.length === 0) return;

      // Contar entradas agendadas no mês para este cliente (por ID ou por client_name da filial)
      const clientEntries = currentMonthEntries.filter((e) => e.client_id === client.id);

      planned.forEach(({ type, qty, branch }) => {
        // Filtrar entries pela filial específica (client_name) — buscar tanto por client_id quanto por client_name
        const relevantEntries = branch
          ? currentMonthEntries.filter((e) => e.client_name === branch)
          : clientEntries;
        const scheduled = relevantEntries.filter(
          (e) => (e.activity || "").toLowerCase() === type.toLowerCase()
        ).length;

        const missing = qty - scheduled;
        if (missing > 0) {
          const branchLabel = branch ? ` (${branch})` : "";
          list.push({
            text: `${client.company_name}${branchLabel} — "${type}": ${scheduled} de ${qty} agendada(s). Faltam ${missing}.`,
          });
        }
      });
    });

    return list;
  }, [clients, allEntries]);

  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          Atividades Pendentes
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{alerts.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[320px] overflow-y-auto space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border bg-amber-50 border-amber-200">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700">{alert.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}