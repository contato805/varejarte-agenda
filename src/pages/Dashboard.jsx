import React, { useState, useCallback, useMemo } from "react";
import { api } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { Calendar, Users, Building2, Activity } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatCard from "../components/dashboard/StatCard";
import ActivityChart from "../components/dashboard/ActivityChart";
import TopClientsChart from "../components/dashboard/TopClientsChart";
import ClientActivitySummary from "../components/dashboard/ClientActivitySummary";
import DashboardFilter, { getPeriodRange } from "../components/dashboard/DashboardFilter";
import DashboardAlerts from "../components/dashboard/DashboardAlerts";
import FinancialSection from "../components/dashboard/FinancialSection";
import BirthdayPanel from "../components/dashboard/BirthdayPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeEntryStatus } from "@/lib/normalizeEntryStatus";

export default function Dashboard() {
  const now = new Date();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(() => sessionStorage.getItem("dash_period") || "month");
  const [customStart, setCustomStart] = useState(() => sessionStorage.getItem("dash_customStart") || format(startOfMonth(now), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(() => sessionStorage.getItem("dash_customEnd") || format(endOfMonth(now), "yyyy-MM-dd"));

  const handlePeriodChange = (p) => {
    setPeriod(p);
    sessionStorage.setItem("dash_period", p);
  };

  const handleCustomChangePersist = (s, e) => {
    setCustomStart(s);
    setCustomEnd(e);
    sessionStorage.setItem("dash_customStart", s);
    sessionStorage.setItem("dash_customEnd", e);
  };

  const { start: rangeStart, end: rangeEnd } = getPeriodRange(period, customStart, customEnd);

  const { data: rawEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["entries", rangeStart, rangeEnd],
    queryFn: () => api.entities.ScheduleEntry.filter({
      date: { $gte: rangeStart, $lte: rangeEnd }
    }),
    enabled: !!rangeStart && !!rangeEnd,
  });

  const entries = useMemo(() => normalizeEntryStatus(rawEntries), [rawEntries]);

  // All entries for alerts (no date filter)
  const { data: rawAllEntries = [] } = useQuery({
    queryKey: ["allEntries"],
    queryFn: () => api.entities.ScheduleEntry.list("-date"),
  });

  const allEntries = useMemo(() => normalizeEntryStatus(rawAllEntries), [rawAllEntries]);

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.entities.Employee.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.entities.Client.list(),
  });

  const isLoading = loadingEntries || loadingEmp;

  // Stats
  const busyDays = new Set(entries.map((e) => e.date)).size;
  const activeClients = clients.filter(c => c.active !== false).length;
  const totalActivities = entries.length;
  const daysInRange = rangeStart && rangeEnd
    ? Math.round((new Date(rangeEnd) - new Date(rangeStart)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  // Chart data
  const dayMap = {};
  entries.forEach((e) => {
    const d = format(new Date(e.date + "T00:00:00"), "dd/MM");
    dayMap[d] = (dayMap[d] || 0) + 1;
  });

  const chartData = [];
  if (rangeStart && rangeEnd) {
    const start = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");
    const maxDays = Math.min(Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1, 31);
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = format(d, "dd/MM");
      chartData.push({ day: key, count: dayMap[key] || 0 });
    }
  }



  const handlePullRefresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["entries"] });
    await queryClient.refetchQueries({ queryKey: ["allEntries"] });
    await queryClient.refetchQueries({ queryKey: ["employees"] });
    await queryClient.refetchQueries({ queryKey: ["clients"] });
  }, [queryClient]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rangeStart && rangeEnd
              ? `${format(new Date(rangeStart + "T00:00:00"), "dd/MM/yyyy")} — ${format(new Date(rangeEnd + "T00:00:00"), "dd/MM/yyyy")}`
              : format(now, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <DashboardFilter
          period={period}
          onPeriodChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={handleCustomChangePersist}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Dias Ocupados"
              value={busyDays}
              subtitle={`de ${daysInRange} dias no período`}
              icon={Calendar}
              color="#3b82f6"
            />
            <StatCard
              title="Clientes Ativos"
              value={activeClients}
              subtitle={`de ${clients.length} cadastrados`}
              icon={Building2}
              color="#10b981"
            />
            <StatCard
              title="Total Atividades"
              value={totalActivities}
              subtitle="no período"
              icon={Activity}
              color="#f59e0b"
            />
            <StatCard
              title="Funcionários Ativos"
              value={employees.filter(e => e.active !== false).length}
              subtitle={`de ${employees.length} cadastrados`}
              icon={Users}
              color="#8b5cf6"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <ActivityChart entries={allEntries} />
          </div>

          <ClientActivitySummary entries={entries} clients={clients} />

          <DashboardAlerts entries={entries} employees={employees} clients={clients} allEntries={allEntries} />

          <BirthdayPanel clients={clients} employees={employees} />

          <FinancialSection entries={entries} employees={employees} clients={clients} />

          <TopClientsChart entries={entries} clients={clients} employees={employees} />
        </>
      )}
    </div>
    </PullToRefresh>
  );
}
