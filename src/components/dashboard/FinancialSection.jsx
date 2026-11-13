import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatCurrency";
import { DollarSign, Users, Building2, Activity, Clock, CheckCircle2, BarChart2 } from "lucide-react";

const MONTHLY_HOURS = 176;

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function MetricCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <Card>
      <CardContent className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground truncate">{value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>);

}

export default function FinancialSection({ entries, employees, clients }) {
  // --- FINANCIAL ---
  const financialData = useMemo(() => {
    let totalCost = 0;
    const clientCostMap = {};
    const activityCostMap = {};

    entries.forEach((e) => {
      const emp = employees.find((em) => em.id === e.employee_id);
      const costPerHour = emp?.monthly_salary ? emp.monthly_salary / MONTHLY_HOURS : 0;
      const hours = calcHours(e.start_time, e.end_time);
      const cost = hours * costPerHour;
      totalCost += cost;

      // per client
      if (e.client_id) {
        clientCostMap[e.client_id] = clientCostMap[e.client_id] || { name: e.client_name || "?", cost: 0, hours: 0 };
        clientCostMap[e.client_id].cost += cost;
        clientCostMap[e.client_id].hours += hours;
      }

      // per activity type
      const act = e.activity || "Outro";
      activityCostMap[act] = activityCostMap[act] || { cost: 0, count: 0 };
      activityCostMap[act].cost += cost;
      activityCostMap[act].count += 1;
    });

    const clientCosts = Object.entries(clientCostMap).
    map(([id, d]) => {
      const client = clients.find((c) => c.id === id);
      const revenue = client?.monthly_contract_value || 0;
      const margin = revenue > 0 ? revenue - d.cost : null;
      const marginPct = revenue > 0 ? d.cost / revenue * 100 : null;
      return { id, name: d.name, cost: d.cost, hours: d.hours, revenue, margin, marginPct };
    }).
    sort((a, b) => b.cost - a.cost);

    const activityCosts = Object.entries(activityCostMap).
    map(([name, d]) => ({ name, cost: d.cost, count: d.count })).
    sort((a, b) => b.cost - a.cost);

    const avgCostPerActivity = entries.length > 0 ? totalCost / entries.length : 0;
    return { totalCost, clientCosts, activityCosts, avgCostPerActivity };
  }, [entries, employees, clients]);

  // --- PRODUCTIVITY ---
  const productivity = useMemo(() => {
    const empStats = employees.filter((e) => e.active !== false).map((emp) => {
      const empEntries = entries.filter((e) => e.employee_id === emp.id);
      const hours = empEntries.reduce((acc, e) => acc + calcHours(e.start_time, e.end_time), 0);
      const occupation = hours / MONTHLY_HOURS * 100;
      const avgTimePerActivity = empEntries.length > 0 ? hours * 60 / empEntries.length : 0;
      return { ...emp, count: empEntries.length, hours, occupation, avgTimePerActivity };
    }).sort((a, b) => b.occupation - a.occupation);

    const totalHours = empStats.reduce((acc, e) => acc + e.hours, 0);
    const avgActivities = empStats.length > 0 ? entries.length / empStats.length : 0;
    const avgTimePerActivity = entries.length > 0 ?
    totalHours * 60 / entries.length :
    0;

    return { empStats, totalHours, avgActivities, avgTimePerActivity };
  }, [entries, employees]);

  // --- OPERATIONAL ---
  const operational = useMemo(() => {
    const realized = entries.filter((e) => e.status === "realizado").length;
    const scheduled = entries.filter((e) => e.status === "agendado").length;
    const cancelled = entries.filter((e) => e.status === "cancelado").length;
    const completionRate = entries.length > 0 ? realized / entries.length * 100 : 0;

    const byActivity = {};
    entries.forEach((e) => {
      const act = e.activity || "Outro";
      byActivity[act] = (byActivity[act] || 0) + 1;
    });
    const activityDist = Object.entries(byActivity).
    map(([name, count]) => ({ name, count })).
    sort((a, b) => b.count - a.count).
    slice(0, 6);

    const activeClients = new Set(entries.filter((e) => e.status !== "cancelado").map((e) => e.client_id)).size;

    return { realized, scheduled, cancelled, completionRate, activityDist, activeClients };
  }, [entries]);

  const hasCostData = financialData.totalCost > 0;
  const hasRevenueData = financialData.clientCosts.some((c) => c.revenue > 0);

  return (
    <div className="space-y-5">
      {/* ── FINANCEIRO ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Financeiro
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <MetricCard icon={DollarSign} label="Custo total do mês" value={hasCostData ? `R$ ${formatCurrency(financialData.totalCost)}` : "—"} sub="salário × horas trabalhadas" iconBg="bg-purple-100" iconColor="text-purple-600" />
          <MetricCard icon={Activity} label="Custo médio/atividade" value={hasCostData ? `R$ ${formatCurrency(financialData.avgCostPerActivity)}` : "—"} iconBg="bg-blue-100" iconColor="text-blue-600" />
          <MetricCard icon={Building2} label="Faturamento clientes ativos" value={`R$ ${formatCurrency((() => { const activeIds = new Set(entries.map(e => e.client_id)); return clients.filter(c => activeIds.has(c.id) && c.monthly_contract_value > 0).reduce((sum, c) => sum + c.monthly_contract_value, 0); })())}`} sub={`${(() => { const activeIds = new Set(entries.map(e => e.client_id)); return clients.filter(c => activeIds.has(c.id) && c.monthly_contract_value > 0).length; })()} clientes no período`} iconBg="bg-emerald-100" iconColor="text-emerald-600" />

        </div>

        {/* Client cost + margin table */}
        {financialData.clientCosts.length > 0 &&
        <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" /> Custo e Margem por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Custo</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Margem %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.clientCosts.map((c, i) =>
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium text-sm">{c.name}</td>
                        <td className="px-4 py-2 text-right font-mono text-purple-700 font-semibold text-sm">
                          {c.cost > 0 ? `R$ ${formatCurrency(c.cost)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-sm">
                          {c.marginPct !== null ?
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${c.marginPct <= 50 ? "bg-emerald-100 text-emerald-700" : c.marginPct <= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                              {c.marginPct.toFixed(0)}%
                            </span> :
                      "—"}
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        }

        {/* Activity cost ranking */}
        {financialData.activityCosts.length > 0 && hasCostData &&
        <Card className="mt-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" /> Custo por Tipo de Atividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {financialData.activityCosts.slice(0, 6).map((a, i) => {
                const maxCost = financialData.activityCosts[0]?.cost || 1;
                return (
                  <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-1/2 flex-shrink-0 truncate">{a.name}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${a.cost / maxCost * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-purple-700 w-20 text-right">R$ {formatCurrency(a.cost)}</span>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">{a.count} ativ.</span>
                    </div>);

              })}
              </div>
            </CardContent>
          </Card>
        }
      </div>

      {/* ── PRODUTIVIDADE ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Produtividade
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MetricCard icon={Clock} label="Horas trabalhadas" value={`${productivity.totalHours.toFixed(1)}h`} sub="todos os colaboradores" iconBg="bg-amber-100" iconColor="text-amber-600" />
          <MetricCard icon={Activity} label="Média ativ./colaborador" value={productivity.avgActivities.toFixed(1)} iconBg="bg-primary/10" iconColor="text-primary" />
          <MetricCard icon={Clock} label="Tempo médio/atividade" value={`${productivity.avgTimePerActivity.toFixed(0)} min`} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        </div>

        {/* Occupation per employee */}
        {productivity.empStats.length > 0 &&
        <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Taxa de Ocupação por Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productivity.empStats.map((emp) => {
                const occ = Math.min(100, emp.occupation);
                const barColor = occ >= 80 ? "#ef4444" : occ >= 60 ? "#f59e0b" : "#10b981";
                return (
                  <div key={emp.id} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color || "#6366f1" }} />
                      <span className="text-sm w-28 truncate font-medium">{emp.name}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${occ}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-xs font-semibold w-12 text-right" style={{ color: barColor }}>
                        {occ.toFixed(0)}%
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right">{emp.hours.toFixed(1)}h · {emp.count} ativ.</span>
                    </div>);

              })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">Base: 176h mensais. Vermelho ≥ 80%, Amarelo ≥ 60%.</p>
            </CardContent>
          </Card>
        }
      </div>



      {/* ── OPERACIONAL ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Operacional
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard icon={CheckCircle2} label="Atividades concluídas" value={operational.realized} sub={`${operational.completionRate.toFixed(0)}% do total`} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
          <MetricCard icon={Activity} label="Agendadas" value={operational.scheduled} iconBg="bg-blue-100" iconColor="text-blue-600" />
          <MetricCard icon={Activity} label="Canceladas" value={operational.cancelled} iconBg="bg-red-100" iconColor="text-red-500" />
          <MetricCard
            icon={Users}
            label="Maior ocupação"
            value={productivity.empStats[0]?.name?.split(" ")[0] || "—"}
            sub={productivity.empStats[0] ? `${Math.min(100, productivity.empStats[0].occupation).toFixed(0)}%` : ""}
            iconBg="bg-purple-100"
            iconColor="text-purple-600" />
          
        </div>

        {/* Activity distribution */}
        {operational.activityDist.length > 0 &&
        <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" /> Distribuição por Tipo de Atividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {operational.activityDist.map((a, i) => {
                const maxCount = operational.activityDist[0]?.count || 1;
                const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
                return (
                  <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-1/2 flex-shrink-0 truncate">{a.name}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${a.count / maxCount * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right" style={{ color: COLORS[i % COLORS.length] }}>{a.count}</span>
                    </div>);

              })}
              </div>
            </CardContent>
          </Card>
        }
      </div>
    </div>);

}