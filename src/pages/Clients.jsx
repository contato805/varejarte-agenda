import React, { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Building2, Phone, Mail, User, ListTodo, CheckCircle2, Circle, MapPin } from "lucide-react";
import BranchActivityEditor from "@/components/clients/BranchActivityEditor";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logAction } from "@/lib/auditLog";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const EMPTY_CONTACT = { name: "", phone: "", email: "", birthday_day: "", birthday_month: "" };
const EMPTY_ACTIVITY = { activity_type: "", quantity: "" };
const EMPTY_BRANCH = { name: "", address: "", active: true, monthly_activities: [] };

const EMPTY_FORM = {
  company_name: "",
  active: true,
  monthly_contract_value: "",
  contacts: [{ ...EMPTY_CONTACT }],
  monthly_activities: [],
  branches: [],
  activity_notes: "",
};

function getSession() {
  try {
    const raw = sessionStorage.getItem("employeeSession");
    if (raw) {
      const s = JSON.parse(raw);
      return { sessionToken: s.token, sessionEmployeeId: s.id };
    }
  } catch {}
  return {};
}

export default function Clients() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: activityTypes = [] } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: async () => {
      const res = await base44.functions.invoke("clientCrud", { action: "listActivityTypes", ...getSession() });
      return res.data.activityTypes || [];
    },
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await base44.functions.invoke("clientCrud", { action: "list", ...getSession() });
      return res.data.clients || [];
    },
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.functions.invoke("clientCrud", { action: "create", data: d, ...getSession() }),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["clients"] });
      const previous = queryClient.getQueryData(["clients"]);
      queryClient.setQueryData(["clients"], (old) => [
        ...(old || []),
        { ...newData, id: "temp-" + Date.now() },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["clients"], context.previous);
      toast.error("Erro ao adicionar cliente. Tente novamente.");
    },
    onSuccess: (_data, variables) => {
      toast.success("Cliente adicionado!");
      logAction({ action: `Criou cliente "${variables?.company_name || ""}"`, category: "cliente" });
      resetForm();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke("clientCrud", { action: "update", id, data, ...getSession() }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["clients"] });
      const previous = queryClient.getQueryData(["clients"]);
      queryClient.setQueryData(["clients"], (old) =>
        (old || []).map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["clients"], context.previous);
      toast.error("Erro ao atualizar cliente. Tente novamente.");
    },
    onSuccess: (_data, variables) => {
      toast.success("Cliente atualizado!");
      logAction({ action: `Editou cliente "${variables?.data?.company_name || ""}"`, category: "cliente" });
      resetForm();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (cl) => base44.functions.invoke("clientCrud", { action: "delete", id: cl.id, ...getSession() }),
    onSuccess: (_data, cl) => {
      queryClient.setQueryData(["clients"], (old) => (old || []).filter((c) => c.id !== cl.id));
      toast.success("Cliente e atividades pendentes removidos!");
      logAction({ action: `Excluiu cliente "${cl?.company_name || ""}" e atividades pendentes`, category: "cliente" });
      queryClient.invalidateQueries({ queryKey: ["scheduleEntries"] });
    },
    onError: () => {
      toast.error("Erro ao excluir cliente. Tente novamente.");
    },
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setOpen(false);
    resetNewInputs();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasBranches = form.branches.filter(b => b.name).length > 0;
    const payload = {
      ...form,
      monthly_contract_value: form.monthly_contract_value || null,
      contacts: form.contacts.filter(c => c.name || c.phone),
      monthly_activities: hasBranches ? [] : form.monthly_activities.filter(a => a.activity_type),
      branches: form.branches.filter(b => b.name),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleEdit = (cl) => {
    setEditing(cl);
    setForm({
      company_name: cl.company_name || "",
      active: cl.active !== false,
      monthly_contract_value: cl.monthly_contract_value || "",
      contacts: cl.contacts || [],
      monthly_activities: cl.monthly_activities || [],
      branches: cl.branches || [],
      activity_notes: cl.activity_notes || "",
    });
    resetNewInputs();
    setOpen(true);
  };

  // New contact/activity input state (fixed form at top)
  const [newContact, setNewContact] = useState({ ...EMPTY_CONTACT });
  const [newActivity, setNewActivity] = useState({ ...EMPTY_ACTIVITY });
  const [newBranch, setNewBranch] = useState({ ...EMPTY_BRANCH });
  const [editingBranchIdx, setEditingBranchIdx] = useState(null);

  // Contact helpers
  const removeContact = (i) => setForm({ ...form, contacts: form.contacts.filter((_, idx) => idx !== i) });
  const addContact = () => {
    if (!newContact.name && !newContact.phone) return;
    setForm({ ...form, contacts: [...form.contacts, { ...newContact }] });
    setNewContact({ ...EMPTY_CONTACT });
  };

  // Monthly activity helpers
  const removeActivity = (i) => setForm({ ...form, monthly_activities: form.monthly_activities.filter((_, idx) => idx !== i) });
  const addActivity = async () => {
    if (!newActivity.activity_type) return;
    setForm({ ...form, monthly_activities: [...form.monthly_activities, { ...newActivity }] });
    setNewActivity({ ...EMPTY_ACTIVITY });
  };

  // Branch helpers
  const removeBranch = (i) => setForm({ ...form, branches: form.branches.filter((_, idx) => idx !== i) });
  const addBranch = () => {
    if (!newBranch.name) return;
    if (editingBranchIdx !== null) {
      const updated = [...form.branches];
      updated[editingBranchIdx] = { ...newBranch };
      setForm({ ...form, branches: updated });
      setEditingBranchIdx(null);
    } else {
      setForm({ ...form, branches: [...form.branches, { ...newBranch }] });
    }
    setNewBranch({ ...EMPTY_BRANCH });
  };
  const startEditBranch = (i) => {
    setNewBranch({ ...form.branches[i] });
    setEditingBranchIdx(i);
  };
  const cancelEditBranch = () => {
    setNewBranch({ ...EMPTY_BRANCH });
    setEditingBranchIdx(null);
  };

  // Reset new inputs when form resets
  const resetNewInputs = () => {
    setNewContact({ ...EMPTY_CONTACT });
    setNewActivity({ ...EMPTY_ACTIVITY });
    setNewBranch({ ...EMPTY_BRANCH });
    setEditingBranchIdx(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus clientes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Empresa */}
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Nome da empresa"
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                  />
                  <span className="text-sm font-medium">{form.active ? "Cliente ativo" : "Cliente inativo"}</span>
                </div>
              </div>

              {/* Valor do contrato mensal */}
              <div className="space-y-2">
                <Label>Valor do contrato mensal (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_contract_value}
                  onChange={(e) => setForm({ ...form, monthly_contract_value: e.target.value ? Number(e.target.value) : "" })}
                  placeholder="Ex: 2500.00 (opcional)"
                />
                <p className="text-xs text-muted-foreground">Usado para calcular margem estimada nos relatórios financeiros.</p>
              </div>

              {/* Contatos */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Contatos</p>

                {/* Fixed input form */}
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="Nome *"
                    />
                    <Input
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="Telefone *"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="Email (opcional)"
                    />
                    <div className="flex gap-1">
                      <Input
                        type="number" min="1" max="31"
                        value={newContact.birthday_day}
                        onChange={(e) => setNewContact({ ...newContact, birthday_day: e.target.value })}
                        placeholder="Dia"
                        className="w-16"
                      />
                      <Select
                        value={newContact.birthday_month ? String(newContact.birthday_month) : ""}
                        onValueChange={(v) => setNewContact({ ...newContact, birthday_month: Number(v) })}
                      >
                        <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, idx) => (
                            <SelectItem key={idx} value={String(idx + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="button" size="sm" onClick={addContact} disabled={!newContact.name && !newContact.phone}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar contato
                  </Button>
                </div>

                {/* Added contacts list */}
                {form.contacts.length > 0 && (
                  <div className="space-y-1.5">
                    {form.contacts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-medium truncate">{c.name}</span>
                          {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                          {c.email && <span className="text-muted-foreground truncate hidden sm:inline">{c.email}</span>}
                          {c.birthday_day && c.birthday_month && (
                            <span className="text-muted-foreground">🎂 {c.birthday_day}/{MONTHS[c.birthday_month - 1]?.slice(0,3)}</span>
                          )}
                        </div>
                        <button type="button" onClick={() => removeContact(i)} className="text-destructive hover:opacity-80 ml-2 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Atividades mensais previstas — só aparece se não tem filiais */}
              {form.branches.length === 0 && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Atividades mensais previstas</p>
                <p className="text-xs text-muted-foreground -mt-1">Sem filiais, as atividades ficam no cadastro geral do cliente.</p>

                {/* Fixed input form */}
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <Select
                    value={newActivity.activity_type}
                    onValueChange={(v) => setNewActivity({ ...newActivity, activity_type: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Tipo de atividade..." /></SelectTrigger>
                    <SelectContent>
                      {activityTypes.map((at) => {
                        const alreadyAdded = form.monthly_activities.some(a => a.activity_type === at.name);
                        return (
                          <SelectItem key={at.id} value={at.name} disabled={alreadyAdded}>
                            {at.name}{alreadyAdded ? " ✓" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min="1"
                    value={newActivity.quantity}
                    onChange={(e) => setNewActivity({ ...newActivity, quantity: Number(e.target.value) })}
                    placeholder="Quantidade (ex: 4)"
                  />
                  <Button type="button" size="sm" onClick={addActivity} disabled={!newActivity.activity_type}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Incluir atividade
                  </Button>
                </div>

                {/* Added activities list */}
                {form.monthly_activities.length > 0 && (
                  <div className="space-y-1.5">
                    {form.monthly_activities.map((act, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs">
                          <span className="font-medium">{act.activity_type}</span>
                          <div className="flex items-center gap-3">
                            {act.quantity > 0 && <span className="text-muted-foreground">{act.quantity}×</span>}
                            <button type="button" onClick={() => removeActivity(i)} className="text-destructive hover:opacity-80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {form.branches.length > 0 && (
                <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-400">
                  As atividades mensais são gerenciadas individualmente em cada filial abaixo.
                </div>
              )}

              {/* Filiais */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Filiais / Unidades de Negócio</p>
                <p className="text-xs text-muted-foreground -mt-1">Cada filial aparece como unidade separada no cronograma.</p>

                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <Input
                    value={newBranch.name}
                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                    placeholder="Nome da filial *"
                  />
                  <Input
                    value={newBranch.address}
                    onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                    placeholder="Endereço (opcional)"
                  />
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={newBranch.active}
                      onCheckedChange={(checked) => setNewBranch({ ...newBranch, active: checked })}
                    />
                    <span className="text-xs">{newBranch.active ? "Ativa" : "Inativa"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={addBranch} disabled={!newBranch.name}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {editingBranchIdx !== null ? "Salvar filial" : "Adicionar filial"}
                    </Button>
                    {editingBranchIdx !== null && (
                      <Button type="button" size="sm" variant="outline" onClick={cancelEditBranch}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>

                {form.branches.length > 0 && (
                  <div className="space-y-2">
                    {form.branches.map((b, i) => (
                      <div key={i} className={`px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs ${b.active === false ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="font-medium truncate">{b.name}</span>
                            {b.address && <span className="text-muted-foreground truncate hidden sm:inline">{b.address}</span>}
                            {b.active === false && <span className="text-muted-foreground">(inativa)</span>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <button type="button" onClick={() => startEditBranch(i)} className="text-muted-foreground hover:text-foreground">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => removeBranch(i)} className="text-destructive hover:opacity-80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <BranchActivityEditor
                          activities={b.monthly_activities || []}
                          activityTypes={activityTypes}
                          onChange={(newActs) => {
                            const updated = [...form.branches];
                            updated[i] = { ...updated[i], monthly_activities: newActs };
                            setForm({ ...form, branches: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-2 border-t border-border pt-4">
                <Label>Observações</Label>
                <Textarea
                  value={form.activity_notes}
                  onChange={(e) => setForm({ ...form, activity_notes: e.target.value })}
                  placeholder="Observações sobre o cliente..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={!form.company_name}>
                  {editing ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse h-[120px]" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar" para começar</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {[...clients].sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "", 'pt-BR')).map((cl) => (
             <Card key={cl.id} className={`hover:shadow-md transition-shadow group ${cl.active === false ? 'opacity-60' : ''}`}>
               <CardContent className="p-4">
                 <div className="flex items-start justify-between">
                   <div className="flex items-start gap-3 min-w-0">
                     <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                       <Building2 className="w-5 h-5 text-primary" />
                     </div>
                     <div className="min-w-0">
                       <div className="flex items-center gap-2">
                         <p className="font-medium text-sm">{cl.company_name}</p>
                         {cl.active !== false ? (
                           <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                         ) : (
                           <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                         )}
                       </div>
                      {/* Contacts summary */}
                      {cl.contacts?.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {cl.contacts.slice(0, 2).map((c, i) => (
                            <div key={i} className="space-y-0.5">
                              {c.name && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="w-3 h-3" /> {c.name}
                                </span>
                              )}
                              {c.phone && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="w-3 h-3" /> {c.phone}
                                </span>
                              )}
                              {c.email && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="w-3 h-3" /> {c.email}
                                </span>
                              )}
                            </div>
                          ))}
                          {cl.contacts.length > 2 && (
                            <p className="text-xs text-muted-foreground">+{cl.contacts.length - 2} contato(s)</p>
                          )}
                        </div>
                      )}
                      {/* Branches summary */}
                      {cl.branches?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-foreground mb-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            Filiais ({cl.branches.length})
                          </div>
                          <div className="space-y-1">
                            {cl.branches.slice(0, 3).map((b, i) => (
                              <div key={i} className={`text-xs ${b.active === false ? 'opacity-50' : ''}`}>
                                <span className={`text-muted-foreground ${b.active === false ? 'line-through' : ''}`}>{b.name}</span>
                                {b.monthly_activities?.length > 0 && (
                                  <span className="ml-1 text-primary font-medium">
                                    ({b.monthly_activities.length} ativ.)
                                  </span>
                                )}
                              </div>
                            ))}
                            {cl.branches.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{cl.branches.length - 3} filial(is)</span>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Activities summary — only show if no branches */}
                      {(!cl.branches || cl.branches.length === 0) && cl.monthly_activities?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-foreground mb-1">
                            <ListTodo className="w-3 h-3 text-primary" />
                            Atividades/mês
                          </div>
                          <div className="space-y-1">
                          {cl.monthly_activities.map((act, i) => (
                             <div key={i} className="flex items-start justify-between text-xs bg-primary/5 rounded px-2 py-1 gap-2">
                               <span className="text-foreground font-medium break-words leading-snug">{act.activity_type || "—"}</span>
                               {act.quantity > 0 && <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">{act.quantity}×</span>}
                             </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cl)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(cl)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="⚠️ Excluir cliente"
        description={`Tem certeza que deseja excluir "${confirmDelete?.company_name}"? Todas as atividades agendadas e pendentes vinculadas a este cliente serão excluídas permanentemente. Esta ação não pode ser desfeita.`}
        onConfirm={() => { deleteMut.mutate(confirmDelete); setConfirmDelete(null); }}
      />
    </div>
  );
}