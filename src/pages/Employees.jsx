import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Users, Eye, EyeOff, Shield, Lock, DollarSign, AlertTriangle, CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { logAction } from "@/lib/auditLog";

const COLORS = [
  "#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#ea580c", "#0d9488", "#4f46e5",
  "#65a30d", "#9333ea", "#0284c7", "#e11d48", "#16a34a",
  "#ca8a04", "#c026d3", "#155e75", "#9a3412", "#1e3a5f",
  "#f43f5e", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
  "#ec4899", "#14b8a6", "#a855f7", "#eab308", "#6366f1",
];

const INITIAL_FORM = { name: "", role: "", color: COLORS[0], access_type: "viewer", login: "", password: "", monthly_salary: "", birthday_day: "", birthday_month: "", active: true };

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Employees() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const formRef = React.useRef(null);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Colors already in use (excluding the one being edited)
  const usedColors = employees
    .filter((e) => !editing || e.id !== editing.id)
    .map((e) => e.color);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Employee.create(d),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Colaborador adicionado!");
      logAction({ action: `Criou colaborador "${variables?.name || ""}"`, category: "colaborador" });
      resetForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Colaborador atualizado!");
      logAction({ action: `Editou colaborador "${variables?.data?.name || ""}"`, category: "colaborador" });
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: async (_data, deletedId) => {
      const emp = employees.find(e => e.id === deletedId);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Colaborador removido!");
      logAction({ action: `Excluiu colaborador "${emp?.name || ""}"`, category: "colaborador" });
    },
  });

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditing(null);
    setOpen(false);
    setFormErrors([]);
  };

  const validateForm = () => {
    const errors = [];
    if (!form.name.trim()) errors.push("Nome é obrigatório");
    if (!form.role.trim()) errors.push("Cargo é obrigatório");
    if (!form.color) errors.push("Selecione uma cor");
    if (!form.login.trim()) errors.push("Login é obrigatório");
    if (!form.password.trim()) errors.push("Senha é obrigatória");
    if (form.monthly_salary === "" || form.monthly_salary === null || form.monthly_salary === undefined) errors.push("Salário mensal é obrigatório");
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      formRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFormErrors([]);
    // Remove empty optional fields so the API doesn't receive invalid empty strings
    const cleanForm = { ...form };
    if (cleanForm.birthday_day === "" || cleanForm.birthday_day === null) delete cleanForm.birthday_day;
    if (cleanForm.birthday_month === "" || cleanForm.birthday_month === null) delete cleanForm.birthday_month;
    
    if (editing) {
      updateMut.mutate({ id: editing.id, data: cleanForm });
    } else {
      createMut.mutate({ ...cleanForm, active: true });
    }
  };

  const handleEdit = (emp) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      role: emp.role || "",
      color: emp.color,
      access_type: emp.access_type || "viewer",
      login: emp.login || "",
      password: emp.password || "",
      monthly_salary: emp.monthly_salary ?? "",
      birthday_day: emp.birthday_day ?? "",
      birthday_month: emp.birthday_month ?? "",
      active: emp.active !== false,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sua equipe</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(INITIAL_FORM); setFormErrors([]); }}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{editing ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
            </DialogHeader>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {formErrors.length > 0 && (
                <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                  <p className="text-xs font-semibold text-destructive mb-1">Preencha os campos obrigatórios:</p>
                  <ul className="list-disc list-inside text-[11px] text-destructive space-y-0.5">
                    {formErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
              {/* Name & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>

                  <Input
                    value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormErrors([]); }}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo *</Label>
                  <Input
                    value={form.role}
                    onChange={(e) => { setForm({ ...form, role: e.target.value }); setFormErrors([]); }}
                    placeholder="Ex: Analista, Consultor..."
                  />
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Cor de Identificação</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => {
                    const isUsed = usedColors.includes(c);
                    const isSelected = form.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={isUsed}
                        onClick={() => !isUsed && setForm({ ...form, color: c })}
                        title={isUsed ? "Cor já em uso" : c}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all relative",
                          isSelected && "ring-2 ring-offset-2 ring-foreground scale-110",
                          isUsed && "opacity-30 cursor-not-allowed",
                          !isUsed && !isSelected && "hover:scale-105 cursor-pointer"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Cores acinzentadas já estão em uso por outro colaborador</p>
              </div>

              {/* Status Ativo/Inativo */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                  />
                  <span className="text-sm font-medium">{form.active ? "Colaborador ativo" : "Colaborador inativo"}</span>
                </div>
                {!form.active && (
                  <p className="text-xs text-muted-foreground">Colaboradores inativos não aparecem na lista ao criar novas atividades.</p>
                )}
              </div>

              {/* Access Type */}
              <div className="space-y-2">
                <Label>Tipo de Acesso</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, access_type: "admin" })}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                      form.access_type === "admin"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Administrador</p>
                      <p className="text-[10px] text-muted-foreground">Acesso total ao sistema</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, access_type: "supervisor" })}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                      form.access_type === "supervisor"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <ClipboardList className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Supervisor</p>
                      <p className="text-[10px] text-muted-foreground">Vê todas as agendas, sem editar</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, access_type: "viewer" })}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                      form.access_type === "viewer"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <Eye className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Visualizador</p>
                      <p className="text-[10px] text-muted-foreground">Só vê sua própria agenda</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Monthly Salary */}
              <div className="space-y-2">
                <Label>Salário Mensal *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_salary}
                  onChange={(e) => { setForm({ ...form, monthly_salary: e.target.value === "" ? "" : Number(e.target.value) }); setFormErrors([]); }}
                  placeholder="Ex: 4000.00"
                />
              </div>

              {/* Birthday */}
              <div className="space-y-2">
                <Label>Aniversário <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dia</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={form.birthday_day}
                      onChange={(e) => setForm({ ...form, birthday_day: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="Ex: 15"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mês</Label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={form.birthday_month}
                      onChange={(e) => setForm({ ...form, birthday_month: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="Ex: 7"
                    />
                  </div>
                </div>
              </div>

              {/* Monthly Salary */}
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Credenciais de Acesso
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Login</Label>
                    <Input
                      value={form.login}
                      onChange={(e) => { setForm({ ...form, login: e.target.value }); setFormErrors([]); }}
                      placeholder="usuário"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => { setForm({ ...form, password: e.target.value }); setFormErrors([]); }}
                        placeholder="••••••"
                        className="h-8 text-xs pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {editing && (
                <div className="border border-destructive/30 rounded-lg p-3 space-y-2 bg-destructive/5">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p className="text-xs font-semibold">Zona de Perigo</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Excluir este colaborador é uma ação <strong>irreversível</strong>. Todos os dados associados serão perdidos permanentemente.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { setOpen(false); setConfirmDelete(editing); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Excluir Colaborador
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1 sticky bottom-0 bg-card pb-1">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit">{editing ? "Atualizar" : "Adicionar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse h-[100px]" />)}
        </div>
      ) : employees.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum colaborador cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar" para começar</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id} className={`hover:shadow-md transition-shadow group ${emp.active === false ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: emp.color }}
                >
                  {emp.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">{emp.name}</p>
                    {emp.active !== false
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      : <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                    {emp.access_type === "admin"
                      ? <Shield className="w-3 h-3 text-primary flex-shrink-0" />
                      : emp.access_type === "supervisor"
                        ? <ClipboardList className="w-3 h-3 text-primary flex-shrink-0" />
                        : <Eye className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                  </div>
                  {emp.role && <p className="text-xs text-muted-foreground">{emp.role}</p>}
                  {emp.login && <p className="text-[10px] text-muted-foreground/70">@{emp.login}</p>}
                  {emp.monthly_salary > 0 && (
                    <p className="text-[10px] text-primary font-medium">
                      R$ {emp.monthly_salary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {emp.birthday_day && emp.birthday_month && (
                    <p className="text-[10px] text-muted-foreground/70">🎂 {emp.birthday_day}/{MONTHS[emp.birthday_month - 1]}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(emp)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Excluir colaborador"
        description={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => { deleteMut.mutate(confirmDelete.id); setConfirmDelete(null); }}
      />
    </div>
  );
}