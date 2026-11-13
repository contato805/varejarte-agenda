import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { addMonths, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CalendarHeader from "../components/calendar/CalendarHeader";
import MonthView from "../components/calendar/MonthView";
import DayView from "../components/calendar/DayView";
import CalendarFilters from "../components/calendar/CalendarFilters";
import EmployeeLegend from "../components/calendar/EmployeeLegend";
import ClientActivityTracker from "../components/calendar/ClientActivityTracker";
import AgendaSummary from "../components/calendar/AgendaSummary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Clock, Building2, User, Plus, Download, Pencil, CheckCircle, XCircle, Trash2, AlertTriangle } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { downloadAgendaPDF } from "@/utils/agendaPdf";
import PullToRefresh from "@/components/ui/PullToRefresh";
import MobileSelect from "@/components/ui/MobileSelect";
import { normalizeEntryStatus } from "@/lib/normalizeEntryStatus";
import { logAction } from "@/lib/auditLog";
import NewEntryDrawer from "@/components/entry/NewEntryDrawer";
import ClientSearchSelect from "@/components/entry/ClientSearchSelect";

function getEmployeeSession() {
  try {
    const raw = sessionStorage.getItem("employeeSession");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Agenda() {
  const empSession = getEmployeeSession();
  const isViewer = empSession && empSession.access_type === "viewer";
  const isSupervisor = empSession && empSession.access_type === "supervisor";
  const isReadOnly = isViewer || isSupervisor;
  const queryClient = useQueryClient();

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({});

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleEntry.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["entries"] });
      const previous = queryClient.getQueryData(["entries"]);
      queryClient.setQueryData(["entries"], (old) =>
        (old || []).map((e) => (e.id === id ? { ...e, ...data } : e))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["entries"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      setEditingEntry(null);
    },
  });

  const handlePullRefresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["entries"] });
    await queryClient.refetchQueries({ queryKey: ["employees"] });
    await queryClient.refetchQueries({ queryKey: ["clients"] });
  }, [queryClient]);

  const handleEditOpen = (entry) => {
    if (isReadOnly) return;
    // Extract branch name from client_name if it contains "—"
    let clientBranch = "";
    if (entry.client_name && entry.client_name.includes("—")) {
      clientBranch = entry.client_name.split("—").slice(1).join("—").trim();
    }
    setEditForm({
      activity: entry.activity || "",
      date: entry.date || "",
      start_time: entry.start_time || "",
      end_time: entry.end_time || "",
      notes: entry.notes || "",
      status: entry.status || "agendado",
      employee_id: entry.employee_id || "",
      client_id: entry.client_id || "",
      client_branch: clientBranch,
    });
    setEditingEntry(entry);
  };

  const handleEditSave = () => {
    if (isReadOnly || !editingEntry) return;
    const emp = employees.find(e => e.id === editForm.employee_id);
    const cli = clients.find(c => c.id === editForm.client_id);
    const clientName = cli?.company_name || "";
    const displayName = editForm.client_branch ? `${clientName} — ${editForm.client_branch}` : clientName;
    const { client_branch, ...editData } = editForm;

    updateMutation.mutate({
      id: editingEntry.id,
      data: {
        ...editData,
        employee_name: emp?.name || editingEntry.employee_name,
        employee_color: emp?.color || editingEntry.employee_color,
        client_name: displayName || editingEntry.client_name,
      },
    });

    // Log each change as a separate audit entry
    const base = `"${editingEntry.activity}" — ${editingEntry.client_name} (${editingEntry.date})`;
    if (editForm.activity !== editingEntry.activity)
      logAction({ action: `Alterou atividade: "${editingEntry.activity}" → "${editForm.activity}"`, category: "agendamento", details: base });
    if (editForm.notes !== (editingEntry.notes || ""))
      logAction({ action: `Alterou observações`, category: "agendamento", details: `${base} | De: "${editingEntry.notes || "(vazio)"}" → Para: "${editForm.notes || "(vazio)"}"` });
    if (editForm.date !== editingEntry.date)
      logAction({ action: `Alterou data: ${editingEntry.date} → ${editForm.date}`, category: "agendamento", details: base });
    if (editForm.start_time !== editingEntry.start_time)
      logAction({ action: `Alterou horário de início: ${editingEntry.start_time} → ${editForm.start_time}`, category: "agendamento", details: base });
    if (editForm.end_time !== editingEntry.end_time)
      logAction({ action: `Alterou horário de término: ${editingEntry.end_time} → ${editForm.end_time}`, category: "agendamento", details: base });
    if (editForm.status !== editingEntry.status)
      logAction({ action: `Alterou status: ${editingEntry.status} → ${editForm.status}`, category: "agendamento", details: base });
    if (editForm.employee_id !== editingEntry.employee_id)
      logAction({ action: `Alterou colaborador: ${editingEntry.employee_name} → ${emp?.name || "?"}`, category: "agendamento", details: base });
    if (editForm.client_id !== editingEntry.client_id)
      logAction({ action: `Alterou cliente: ${editingEntry.client_name} → ${cli?.company_name || "?"}`, category: "agendamento", details: base });
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // "month" or "day"
  const [filters, setFilters] = useState({ employees: [], clients: [], dateStart: null, dateEnd: null });
  const [selectedDay, setSelectedDay] = useState(null);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState("");
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);

  const isFullAdmin = !isReadOnly; // platform user or employee admin — same logic as layout

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleEntry.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["entries"], (old) => (old || []).filter((e) => e.id !== id));
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: rawEntries = [] } = useQuery({
    queryKey: ["entries"],
    queryFn: async () => {
      const results = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.ScheduleEntry.list("-date", 500, skip);
        results.push(...batch);
        if (batch.length < 500) break;
        skip += 500;
      }
      return results;
    },
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: () => base44.entities.ActivityType.list(),
  });

  const entries = useMemo(() => normalizeEntryStatus(rawEntries), [rawEntries]);

  // Employees & clients that have at least one entry in the current month
  const monthStr = format(currentDate, "yyyy-MM");
  const employeesInMonth = useMemo(() => {
    const idsInMonth = new Set(entries.filter(e => e.date?.startsWith(monthStr)).map(e => e.employee_id));
    return employees.filter(e => idsInMonth.has(e.id));
  }, [entries, employees, monthStr]);

  const clientsInMonth = useMemo(() => {
    const idsInMonth = new Set(entries.filter(e => e.date?.startsWith(monthStr)).map(e => e.client_id));
    return clients.filter(c => idsInMonth.has(c.id));
  }, [entries, clients, monthStr]);

  const filteredEntries = useMemo(() => {
    // Extract actual client IDs from composite keys (c:ID or b:ID:idx)
    const selectedClientIds = filters.clients.length > 0
      ? [...new Set(filters.clients.map(k => {
          if (k.startsWith("c:")) return k.slice(2);
          if (k.startsWith("b:")) return k.split(":")[1];
          return k;
        }))]
      : [];

    return entries.filter((e) => {
      if (isViewer && empSession && e.employee_id !== empSession.id) return false;
      if (filters.employees.length > 0 && !filters.employees.includes(e.employee_id)) return false;
      if (selectedClientIds.length > 0 && !selectedClientIds.includes(e.client_id)) return false;
      if (filters.dateStart && e.date < filters.dateStart) return false;
      if (filters.dateEnd && e.date > filters.dateEnd) return false;
      return true;
    });
  }, [entries, filters, isViewer, empSession]);

  const handlePrev = () => {
    setCurrentDate(view === "month" ? subMonths(currentDate, 1) : new Date(currentDate.getTime() - 86400000));
  };
  const handleNext = () => {
    setCurrentDate(view === "month" ? addMonths(currentDate, 1) : new Date(currentDate.getTime() + 86400000));
  };
  const handleToday = () => setCurrentDate(new Date());

  const dayEntries = selectedDay
    ? filteredEntries.filter((e) => e.date === format(selectedDay, "yyyy-MM-dd"))
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    : [];

  // Detect schedule conflicts: same employee, overlapping times, excluding cancelled
  const conflictIds = useMemo(() => {
    const ids = new Set();
    const active = dayEntries.filter(e => e.status !== "cancelado");
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (a.employee_id === b.employee_id && a.start_time < b.end_time && b.start_time < a.end_time) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [dayEntries]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="space-y-4">
      {/* Header row with calendar nav + Nova Entrada button */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <CalendarHeader
            currentDate={currentDate}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            view={view}
            onViewChange={setView}
            onCustomDateRange={(start, end) => {
              setFilters((f) => ({ ...f, dateStart: start, dateEnd: end }));
              if (start) setCurrentDate(new Date(start + "T00:00:00"));
            }}
          />
        </div>
        {/* Download PDF */}
        {isViewer ? (
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={async () => {
              const myEntries = entries.filter(e => e.employee_id === empSession.id);
              await downloadAgendaPDF(myEntries, currentDate, "employee", empSession.name);
            }}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </Button>
        ) : (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 shrink-0">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar PDF</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-[60vh] overflow-y-auto">
              <DropdownMenuLabel className="text-xs text-muted-foreground">PDF por Cliente</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[...clients]
                .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""))
                .map((c) => {
                  const branches = (c.branches || []).filter(b => b.active !== false);
                  const hasBranches = branches.length > 0;

                  if (!hasBranches) {
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={async () => {
                          const ces = entries.filter(e => e.client_id === c.id);
                          await downloadAgendaPDF(ces, currentDate, "client", c.company_name);
                          if (isFullAdmin) logAction({ action: `Exportou cronograma PDF do cliente "${c.company_name}" — ${format(currentDate, "MMMM/yyyy", { locale: ptBR })}`, category: "cronograma" });
                        }}
                      >
                        <Building2 className="w-3.5 h-3.5 mr-2 text-primary" />
                        {c.company_name}
                      </DropdownMenuItem>
                    );
                  }

                  return (
                    <React.Fragment key={c.id}>
                      <DropdownMenuLabel className="text-sm font-normal text-foreground px-2 py-1.5 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        {c.company_name}
                      </DropdownMenuLabel>
                      {branches.map((br, idx) => (
                        <DropdownMenuItem
                          key={`${c.id}-${idx}`}
                          className="pl-8"
                          onClick={async () => {
                            const ces = entries.filter(e => e.client_id === c.id);
                            await downloadAgendaPDF(ces, currentDate, "client", `${c.company_name} - ${br.name}`);
                            if (isFullAdmin) logAction({ action: `Exportou cronograma PDF "${c.company_name} - ${br.name}" — ${format(currentDate, "MMMM/yyyy", { locale: ptBR })}`, category: "cronograma" });
                          }}
                        >
                          <span className="text-muted-foreground">{br.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </React.Fragment>
                  );
                })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">PDF por Colaborador</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[...employees].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((emp) => (
                <DropdownMenuItem
                  key={emp.id}
                  onClick={async () => {
                    const ees = entries.filter(e => e.employee_id === emp.id);
                    await downloadAgendaPDF(ees, currentDate, "employee", emp.name);
                    if (isFullAdmin) logAction({ action: `Exportou cronograma PDF do colaborador "${emp.name}" — ${format(currentDate, "MMMM/yyyy", { locale: ptBR })}`, category: "cronograma" });
                  }}
                >
                  <div className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: emp.color || "#6366f1" }} />
                  {emp.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!isReadOnly && (
          <Button className="gap-2 shrink-0" onClick={() => { setNewEntryDate(""); setNewEntryOpen(true); }}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Entrada</span>
          </Button>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <CalendarFilters
            employees={employeesInMonth}
            clients={clientsInMonth}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>
      )}

      <AgendaSummary
        entries={filteredEntries}
        currentDate={currentDate}
        filters={filters}
        employees={employees}
        clients={clients}
      />

      {view === "month" ? (
        <MonthView
          currentDate={currentDate}
          entries={filteredEntries}
          onDayClick={setSelectedDay}
          isViewer={isViewer}
        />
      ) : (
        <DayView currentDate={currentDate} entries={filteredEntries} onPrev={handlePrev} onNext={handleNext} onToday={handleToday} />
      )}

      {!isReadOnly && (
        <ClientActivityTracker
          clients={clients}
          entries={entries}
          currentDate={currentDate}
          filters={filters}
        />
      )}

      {/* Legenda dos colaboradores */}
      {!isViewer && <EmployeeLegend employees={employees} />}

      {/* Edit entry dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Atividade</Label>
                <MobileSelect value={editForm.activity || ""} onValueChange={v => setEditForm(f => ({ ...f, activity: v }))} placeholder="Selecione..." label="Atividade">
                  {activityTypes.map(at => <SelectItem key={at.id} value={at.name}>{at.name}</SelectItem>)}
                </MobileSelect>
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={editForm.date || ""} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <MobileSelect value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))} label="Status">
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                </MobileSelect>
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={editForm.start_time || ""} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={editForm.end_time || ""} onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Colaborador</Label>
                <MobileSelect value={editForm.employee_id} onValueChange={v => setEditForm(f => ({ ...f, employee_id: v }))} placeholder="Selecione" label="Colaborador">
                    {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                </MobileSelect>
              </div>
              <div>
                <Label className="text-xs">Cliente</Label>
                <ClientSearchSelect
                  clients={clients}
                  value={editForm.client_id}
                  clientBranch={editForm.client_branch}
                  onChange={(clientId, branchName) => setEditForm(f => ({ ...f, client_id: clientId, client_branch: branchName }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancelar</Button>
              <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>
                {selectedDay && format(selectedDay, "dd 'de' MMMM, EEEE", { locale: ptBR })}
              </DialogTitle>
              {!isReadOnly && selectedDay && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                  setNewEntryDate(format(selectedDay, "yyyy-MM-dd"));
                  setSelectedDay(null);
                  setNewEntryOpen(true);
                }}>
                  <Plus className="w-3.5 h-3.5" />
                  Nova
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma atividade neste dia
              </p>
            ) : (
              dayEntries.map((entry, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border hover:shadow-sm transition-shadow"
                  style={{ borderLeftWidth: "4px", borderLeftColor: entry.employee_color || "#6366f1" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm">{entry.activity}</p>
                      {conflictIds.has(entry.id) && (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600 shrink-0" title="Conflito de horário">
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {entry.start_time} - {entry.end_time}
                      </span>
                      {!isReadOnly && (
                        <button onClick={() => handleEditOpen(entry)}
                          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" />
                      {entry.employee_name}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Building2 className="w-3 h-3 text-primary" />
                      {entry.client_name?.includes("—") ? entry.client_name.split("—").slice(1).join("—").trim() : entry.client_name}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{entry.notes}</p>
                  )}
                  {!isReadOnly && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {entry.status === "agendado" && (
                        <>
                          <button
                            onClick={() => {
                              updateMutation.mutate({ id: entry.id, data: { status: "realizado" } });
                              logAction({ action: `Marcou como realizada: "${entry.activity}" — ${entry.client_name}`, category: "agendamento" });
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                            <CheckCircle className="w-3 h-3" /> Realizada
                          </button>
                          <button
                            onClick={() => {
                              updateMutation.mutate({ id: entry.id, data: { status: "cancelado" } });
                              logAction({ action: `Cancelou atividade: "${entry.activity}" — ${entry.client_name} (${entry.date})`, category: "agendamento" });
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                            <XCircle className="w-3 h-3" /> Cancelada
                          </button>
                        </>
                      )}
                      {entry.status === "realizado" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3" /> Realizada
                        </span>
                      )}
                      {entry.status === "cancelado" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-600">
                          <XCircle className="w-3 h-3" /> Cancelada
                        </span>
                      )}
                      {isFullAdmin && (
                        <button
                          onClick={() => setConfirmDeleteEntry(entry)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          <Trash2 className="w-3 h-3" /> Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <NewEntryDrawer
        open={newEntryOpen}
        onOpenChange={setNewEntryOpen}
        initialDate={newEntryDate}
      />
      <ConfirmDialog
        open={!!confirmDeleteEntry}
        onOpenChange={(v) => !v && setConfirmDeleteEntry(null)}
        title="Excluir atividade"
        description={`Tem certeza que deseja excluir "${confirmDeleteEntry?.activity}" — ${confirmDeleteEntry?.client_name} (${confirmDeleteEntry?.date})?`}
        onConfirm={() => {
          if (isReadOnly) return;
          const e = confirmDeleteEntry;
          deleteMutation.mutate(e.id);
          logAction({ action: `Excluiu atividade: "${e.activity}" — ${e.client_name} (${e.date}, ${e.start_time}-${e.end_time})`, category: "agendamento" });
          setConfirmDeleteEntry(null);
          setSelectedDay(null);
        }}
      />
    </div>
    </PullToRefresh>
  );
}