import React, { useState, useRef, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import MobileSelect from "@/components/ui/MobileSelect";
import ClientSearchSelect from "@/components/entry/ClientSearchSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Plus, CalendarDays, Clock, X } from "lucide-react";
import { format, parse } from "date-fns";
import DatePickerDrawer from "@/components/entry/DatePickerDrawer";
import TimePickerDrawer from "@/components/entry/TimePickerDrawer";

const INITIAL = {
  employee_id: "",
  client_id: "",
  client_branch: "",
  activity: "",
  date: "",
  start_time: "08:00",
  end_time: "09:00",
  notes: "",
};

export default function NewEntryDrawer({ open, onOpenChange, initialDate = "" }) {
  const [form, setForm] = useState({ ...INITIAL, date: initialDate });
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [startTimeDrawerOpen, setStartTimeDrawerOpen] = useState(false);
  const [endTimeDrawerOpen, setEndTimeDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const panelRef = useRef(null);

  // Reset form when panel opens
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL, date: initialDate });
    }
  }, [open, initialDate]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Don't close if clicking on a sub-drawer/dialog
        const isInsidePortal = e.target.closest("[data-radix-popper-content-wrapper]") ||
          e.target.closest("[role='dialog']") ||
          e.target.closest("[data-vaul-drawer]") ||
          e.target.closest("[data-radix-select-content]");
        if (!isInsidePortal) {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.entities.Employee.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.entities.Client.list(),
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: () => api.entities.ActivityType.list(),
  });

  const createActivityTypeMutation = useMutation({
    mutationFn: (data) => api.entities.ActivityType.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["activityTypes"] });
      setForm((prev) => ({ ...prev, activity: created.name }));
      setNewActivityName("");
      setNewActivityOpen(false);
      toast.success("Tipo de atividade criado!");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ScheduleEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Atividade adicionada com sucesso!");
      setForm(INITIAL);
      onOpenChange(false);
    },
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const emp = employees.find((em) => em.id === form.employee_id);
    const cl = clients.find((c) => c.id === form.client_id);
    const clientName = cl?.company_name || "";
    const displayName = form.client_branch ? `${clientName} — ${form.client_branch}` : clientName;
    const { client_branch, ...formData } = form;
    createMutation.mutate({
      ...formData,
      employee_name: emp?.name || "",
      client_name: displayName,
      employee_color: emp?.color || "#6366f1",
    });
  };

  const handleCreateActivity = () => {
    if (!newActivityName.trim()) return;
    createActivityTypeMutation.mutate({ name: newActivityName.trim() });
  };

  const isValid = form.employee_id && form.client_id && form.activity && form.date && form.start_time && form.end_time;

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => onOpenChange(false)} />

      {/* Floating panel */}
      <div
        ref={panelRef}
        className="fixed z-50 left-1/2 -translate-x-1/2 w-[92%] max-w-lg bg-card border border-border rounded-xl shadow-2xl"
        style={{ top: "calc(64px + 40px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarPlus className="w-4 h-4 text-primary" />
            Nova Entrada
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body */}
        <div className="px-4 py-4 overflow-y-auto max-h-[calc(100vh-64px-40px-60px-2rem)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Colaborador *</Label>
                <MobileSelect value={form.employee_id} onValueChange={(v) => handleChange("employee_id", v)} placeholder="Selecione..." label="Colaborador">
                  {[...employees].filter(emp => emp.active !== false).sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR")).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color }} />
                        {emp.name}
                      </div>
                    </SelectItem>
                  ))}
                </MobileSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <ClientSearchSelect
                  clients={clients}
                  value={form.client_id}
                  clientBranch={form.client_branch}
                  onChange={(clientId, branchName) => setForm(prev => ({ ...prev, client_id: clientId, client_branch: branchName }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Atividade *</Label>
                <button
                  type="button"
                  onClick={() => setNewActivityOpen(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Nova atividade
                </button>
              </div>
              <MobileSelect value={form.activity} onValueChange={(v) => handleChange("activity", v)} placeholder="Selecione a atividade..." label="Atividade">
                {activityTypes.map((at) => (
                  <SelectItem key={at.id} value={at.name}>
                    {at.name}
                  </SelectItem>
                ))}
              </MobileSelect>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data *</Label>
                <button
                  type="button"
                  onClick={() => setDateDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className={form.date ? "text-foreground text-xs" : "text-muted-foreground text-xs"}>
                    {form.date
                      ? format(parse(form.date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                      : "dd/mm/aaaa"}
                  </span>
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Início *</Label>
                <button
                  type="button"
                  onClick={() => setStartTimeDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground text-xs">{form.start_time}</span>
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Término *</Label>
                <button
                  type="button"
                  onClick={() => setEndTimeDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground text-xs">{form.end_time}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Notas adicionais..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...INITIAL, date: initialDate })}>
                Limpar
              </Button>
              <Button type="submit" size="sm" disabled={!isValid || createMutation.isPending} className="min-w-[130px]">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Atividade"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <DatePickerDrawer
        open={dateDrawerOpen}
        onOpenChange={setDateDrawerOpen}
        value={form.date}
        onChange={(v) => handleChange("date", v)}
      />
      <TimePickerDrawer
        open={startTimeDrawerOpen}
        onOpenChange={setStartTimeDrawerOpen}
        value={form.start_time}
        onChange={(v) => handleChange("start_time", v)}
        title="Horário de Início"
      />
      <TimePickerDrawer
        open={endTimeDrawerOpen}
        onOpenChange={setEndTimeDrawerOpen}
        value={form.end_time}
        onChange={(v) => handleChange("end_time", v)}
        title="Horário de Término"
      />

      {/* New Activity Type Dialog */}
      <Dialog open={newActivityOpen} onOpenChange={setNewActivityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da atividade</Label>
              <Input
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                placeholder="Ex: Treinamento, Visita técnica..."
                onKeyDown={(e) => e.key === "Enter" && handleCreateActivity()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setNewActivityOpen(false); setNewActivityName(""); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateActivity}
                disabled={!newActivityName.trim() || createActivityTypeMutation.isPending}
              >
                {createActivityTypeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}