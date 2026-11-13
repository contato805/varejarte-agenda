import React, { useState, useMemo, useRef, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Calendar, Building2, User, Zap, ChevronDown, Check, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ReportEmployees from "@/components/reports/ReportEmployees";
import ReportClients from "@/components/reports/ReportClients";
import ReportVarejarte from "@/components/reports/ReportVarejarte";
import ClientBranchDropdown from "@/components/reports/ClientBranchDropdown";
import DatePickerDrawer from "@/components/entry/DatePickerDrawer";
import { logAction } from "@/lib/auditLog";

const PERIODS = [
  { label: "Mês Atual", value: "current" },
  { label: "Mês Passado", value: "last" },
  { label: "Mês que Vem", value: "next" },
  { label: "Personalizado", value: "custom" },
];

const REPORT_TABS = [
  { key: "employees", label: "Colaboradores", icon: User, color: "text-primary", activeBg: "bg-primary text-primary-foreground" },
  { key: "clients", label: "Clientes", icon: Building2, color: "text-emerald-600", activeBg: "bg-emerald-600 text-white" },
  { key: "varejarte", label: "Consolidado Varejarte", icon: Zap, color: "text-purple-600", activeBg: "bg-purple-600 text-white" },
];

function MultiSelectDropdown({ icon: Icon, placeholder, items, selected, setSelected, getLabel, getId, accentColor = "bg-primary border-primary" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? getLabel(items.find((i) => getId(i) === selected[0]))
      : `${selected.length} selecionados`;

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent transition-colors min-w-[180px] justify-between"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
          <button
            onClick={() => { setSelected([]); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.length === 0 ? accentColor : "border-border"}`}>
              {selected.length === 0 && <Check className="w-3 h-3 text-white" />}
            </div>
            Todos
          </button>
          <div className="border-t border-border my-1" />
          {items.map((item) => {
            const id = getId(item);
            const active = selected.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${active ? accentColor : "border-border"}`}>
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
                {item.color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
                <span className="truncate">{getLabel(item)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("employees");
  const [period, setPeriod] = useState("current");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [datePickerTarget, setDatePickerTarget] = useState(null); // "start" | "end" | null
  
  const employeesReportRef = React.useRef();
  const clientsReportRef = React.useRef();
  const varejarteReportRef = React.useRef();
  
  const handleExportPDF = () => {
    const tabLabels = { employees: "Colaboradores", clients: "Clientes", varejarte: "Consolidado Varejarte" };
    if (activeTab === "employees" && employeesReportRef.current?.handleExportPDF) {
      employeesReportRef.current.handleExportPDF();
      logAction({ action: `Exportou relatório "${tabLabels[activeTab]}" — ${periodLabel}`, category: "relatorio" });
    } else if (activeTab === "clients" && clientsReportRef.current?.handleExportPDF) {
      clientsReportRef.current.handleExportPDF();
      logAction({ action: `Exportou relatório "${tabLabels[activeTab]}" — ${periodLabel}`, category: "relatorio" });
    } else if (activeTab === "varejarte" && varejarteReportRef.current?.handleExportPDF) {
      varejarteReportRef.current.handleExportPDF();
      logAction({ action: `Exportou relatório "${tabLabels[activeTab]}" — ${periodLabel}`, category: "relatorio" });
    }
  };

  const { dateStart, dateEnd } = useMemo(() => {
    const now = new Date();
    if (period === "current") return { dateStart: format(startOfMonth(now), "yyyy-MM-dd"), dateEnd: format(endOfMonth(now), "yyyy-MM-dd") };
    if (period === "last") {
      const l = subMonths(now, 1);
      return { dateStart: format(startOfMonth(l), "yyyy-MM-dd"), dateEnd: format(endOfMonth(l), "yyyy-MM-dd") };
    }
    if (period === "next") {
      const n = addMonths(now, 1);
      return { dateStart: format(startOfMonth(n), "yyyy-MM-dd"), dateEnd: format(endOfMonth(n), "yyyy-MM-dd") };
    }
    return { dateStart: customStart, dateEnd: customEnd };
  }, [period, customStart, customEnd]);

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["entries", dateStart, dateEnd],
    queryFn: async () => {
      if (!dateStart || !dateEnd) return [];
      const cutoff30 = format(subDays(new Date(dateStart + "T12:00:00"), 30), "yyyy-MM-dd");
      const earliest = cutoff30 < dateStart ? cutoff30 : dateStart;
      return api.entities.ScheduleEntry.filter(
        { date: { $gte: earliest, $lte: dateEnd } },
        "-date"
      );
    },
    enabled: !!(dateStart && dateEnd),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.entities.Client.list(),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.entities.Employee.list(),
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (dateStart && e.date < dateStart) return false;
      if (dateEnd && e.date > dateEnd) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, dateStart, dateEnd]);

  // Last 30 days entries for insights
  const last30Days = useMemo(() => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    return entries.filter((e) => e.date >= cutoff);
  }, [entries]);

  const periodLabel = useMemo(() => {
    if (period === "current") return format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
    if (period === "last") return format(subMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR });
    if (period === "next") return format(addMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR });
    if (customStart && customEnd) {
      const startFormatted = format(new Date(customStart + "T12:00:00"), "dd/MM/yyyy");
      const endFormatted = format(new Date(customEnd + "T12:00:00"), "dd/MM/yyyy");
      return `${startFormatted} a ${endFormatted}`;
    }
    return "Período personalizado";
  }, [period, customStart, customEnd]);

  const isCustomMissingDates = period === "custom" && (!customStart || !customEnd);

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Relatórios</h1>
      </div>

      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                isActive
                  ? `${tab.activeBg} border-transparent shadow-md`
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-inherit" : tab.color}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Period filters + entity filter + export button */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  period === p.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-sm text-muted-foreground font-medium">{periodLabel}</span>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDatePickerTarget("start")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-accent transition-colors min-w-[140px]"
                >
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className={customStart ? "text-foreground" : "text-muted-foreground"}>
                    {customStart ? format(new Date(customStart + "T12:00:00"), "dd/MM/yyyy") : "dd/mm/aaaa"}
                  </span>
                </button>
                <span className="text-muted-foreground text-sm">até</span>
                <button
                  onClick={() => setDatePickerTarget("end")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-accent transition-colors min-w-[140px]"
                >
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className={customEnd ? "text-foreground" : "text-muted-foreground"}>
                    {customEnd ? format(new Date(customEnd + "T12:00:00"), "dd/MM/yyyy") : "dd/mm/aaaa"}
                  </span>
                </button>
              </div>
            )}
            {/* Entity filter inline */}
            {activeTab === "employees" && (
              <MultiSelectDropdown
                icon={User}
                placeholder="Todos os colaboradores"
                items={employees}
                selected={selectedEmployees}
                setSelected={setSelectedEmployees}
                getLabel={(i) => i?.name || ""}
                getId={(i) => i.id}
                accentColor="bg-primary border-primary"
              />
            )}
            {activeTab === "clients" && (
              <>
                <MultiSelectDropdown
                  icon={User}
                  placeholder="Todos os colaboradores"
                  items={employees}
                  selected={selectedEmployees}
                  setSelected={setSelectedEmployees}
                  getLabel={(i) => i?.name || ""}
                  getId={(i) => i.id}
                  accentColor="bg-primary border-primary"
                />
                <ClientBranchDropdown
                  clients={clients}
                  entries={entries}
                  selected={selectedClients}
                  setSelected={setSelectedClients}
                />
              </>
            )}
            <div className="ml-auto">
              <Button 
                onClick={handleExportPDF}
                className="gap-2" 
                disabled={filtered.length === 0 || isCustomMissingDates}
              >
                <Download className="w-4 h-4" /> Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Missing dates warning */}
      {isCustomMissingDates && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Selecione a data de <strong>início</strong> e <strong>fim</strong> do período personalizado para visualizar e exportar o relatório.</span>
        </div>
      )}

      {/* Report content */}
      {activeTab === "employees" && (
        <ReportEmployees ref={employeesReportRef} entries={filtered} employees={employees} periodLabel={periodLabel} selectedEmployees={selectedEmployees} />
      )}
      {activeTab === "clients" && (
        <ReportClients ref={clientsReportRef} entries={filtered} clients={clients} employees={employees} periodLabel={periodLabel} selectedClients={selectedClients} selectedEmployees={selectedEmployees} />
      )}
      {activeTab === "varejarte" && (
        <ReportVarejarte
          ref={varejarteReportRef}
          entries={filtered}
          clients={clients}
          employees={employees}
          periodLabel={periodLabel}
          allEntries={last30Days}
        />
      )}

      <DatePickerDrawer
        open={datePickerTarget !== null}
        onOpenChange={(open) => { if (!open) setDatePickerTarget(null); }}
        value={datePickerTarget === "start" ? customStart : customEnd}
        onChange={(val) => {
          if (datePickerTarget === "start") setCustomStart(val);
          else setCustomEnd(val);
          setDatePickerTarget(null);
        }}
      />
    </div>
  );
}