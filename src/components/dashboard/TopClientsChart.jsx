import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

const MONTHLY_HOURS = 176;

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export default function TopClientsChart({ entries, clients, employees = [] }) {
  const clientMap = {};
  entries.forEach((e) => {
    if (!e.client_id) return;
    if (!clientMap[e.client_id]) {
      clientMap[e.client_id] = {
        id: e.client_id,
        name: e.client_name || clients.find((c) => c.id === e.client_id)?.company_name || "Desconhecido",
        count: 0,
        cost: 0,
      };
    }
    clientMap[e.client_id].count++;
    const emp = employees.find((em) => em.id === e.employee_id);
    const costPerHour = emp?.monthly_salary ? emp.monthly_salary / MONTHLY_HOURS : 0;
    const hours = calcHours(e.start_time, e.end_time);
    clientMap[e.client_id].cost += hours * costPerHour;
  });

  const allSorted = Object.values(clientMap).sort((a, b) => b.cost - a.cost);
  const sorted = allSorted.slice(0, 10);

  const maxCost = Math.max(...sorted.map((c) => c.cost), 1);

  const BAR_COLORS = [
    "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  ];

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 self-start">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Top 10 Clientes — Maiores Gastos de Mão de Obra
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma atividade registrada este mês
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sorted.map((client, idx) => (
              <div key={client.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{client.name}</span>
                    <span
                      className="text-xs font-bold ml-2 flex-shrink-0"
                      style={{ color: BAR_COLORS[idx] }}
                    >
                      {client.cost > 0 ? `R$ ${formatCurrency(client.cost)}` : `${client.count} ativ.`}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(client.cost / maxCost) * 100}%`,
                        backgroundColor: BAR_COLORS[idx],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}