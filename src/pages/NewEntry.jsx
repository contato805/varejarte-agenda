import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectItem } from "@/components/ui/select";
import MobileSelect from "@/components/ui/MobileSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Plus, CalendarDays, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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

export default function NewEntry() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialDate = urlParams.get("date") || "";
  const [form, setForm] = useState({ ...INITIAL, date: initialDate });
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [startTimeDrawerOpen, setStartTimeDrawerOpen] = useState(false);
  const [endTimeDrawerOpen, setEndTimeDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
      navigate(createPageUrl("Agenda"));
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

  return (
    <div className="max-w-2xl mx-auto pb-20 sm:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Nova Entrada</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adicione uma nova atividade à agenda
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary" />
            Dados da Atividade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Colaborador *</Label>
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

              <div className="space-y-2">
                <Label>Cliente *</Label>
                <MobileSelect
                  value={form.client_branch ? `${form.client_id}::${form.client_branch}` : form.client_id}
                  onValueChange={(v) => {
                    // v format: "clientId" or "clientId::branchName"
                    const [clientId, branchName] = v.split("::");
                    setForm(prev => ({ ...prev, client_id: clientId, client_branch: branchName || "" }));
                  }}
                  placeholder="Selecione..."
                  label="Cliente"
                >
                  {clients.filter(cl => cl.active !== false).flatMap((cl) => {
                    const activeBranches = (cl.branches || []).filter(b => b.active !== false && b.name);
                    if (activeBranches.length > 0) {
                      return activeBranches.map((branch) => (
                        <SelectItem key={`${cl.id}::${branch.name}`} value={`${cl.id}::${branch.name}`}>
                          {cl.company_name} — {branch.name}
                        </SelectItem>
                      ));
                    }
                    return [
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.company_name}
                      </SelectItem>
                    ];
                  })}
                </MobileSelect>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Atividade *</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <button
                  type="button"
                  onClick={() => setDateDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className={form.date ? "text-foreground" : "text-muted-foreground"}>
                    {form.date
                      ? format(parse(form.date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                      : "dd/mm/aaaa"}
                  </span>
                </button>
              </div>
              <div className="space-y-2">
                <Label>Início *</Label>
                <button
                  type="button"
                  onClick={() => setStartTimeDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{form.start_time}</span>
                </button>
              </div>
              <div className="space-y-2">
                <Label>Término *</Label>
                <button
                  type="button"
                  onClick={() => setEndTimeDrawerOpen(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{form.end_time}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Notas adicionais..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setForm(INITIAL)}>
                Limpar
              </Button>
              <Button type="submit" disabled={!isValid || createMutation.isPending} className="min-w-[140px]">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Atividade"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}