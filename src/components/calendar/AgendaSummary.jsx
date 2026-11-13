import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Building2, Activity } from "lucide-react";

function SummaryItem({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 min-w-0">
      <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate leading-tight">{label}</p>
        <p className="text-lg font-bold text-foreground leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function AgendaSummary({ entries, currentDate, filters, employees, clients }) {
  const monthStart = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const monthEntries = useMemo(() => {
    return entries.filter((e) => e.date >= monthStart && e.date <= monthEnd);
  }, [entries, monthStart, monthEnd]);

  const totalActivities = monthEntries.length;
  const uniqueEmployees = new Set(monthEntries.map((e) => e.employee_id)).size;
  const uniqueClients = new Set(monthEntries.map((e) => e.client_id)).size;

  const isFiltered = filters.employees.length > 0 || filters.clients.length > 0;
  const filterDesc = [];
  if (filters.employees.length > 0) {
    const names = filters.employees.map((id) => employees.find((e) => e.id === id)?.name).filter(Boolean);
    filterDesc.push(names.join(", "));
  }
  if (filters.clients.length > 0) {
    const names = filters.clients.map((id) => clients.find((c) => c.id === id)?.company_name).filter(Boolean);
    filterDesc.push(names.join(", "));
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resumo do Mês</h3>
          {isFiltered && (
            <p className="text-xs text-muted-foreground truncate max-w-[400px]">
              Filtrado por: {filterDesc.join(" · ")}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SummaryItem icon={Activity} label="Atividades" value={totalActivities} color="#3b82f6" />
        <SummaryItem icon={Users} label="Funcionários" value={uniqueEmployees} color="#8b5cf6" />
        <SummaryItem icon={Building2} label="Clientes" value={uniqueClients} color="#ef4444" />
      </div>
    </Card>
  );
}