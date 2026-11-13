import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Tag, Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ReplaceActivityDialog from "@/components/activityTypes/ReplaceActivityDialog";
import { logAction } from "@/lib/auditLog";

export default function ActivityTypes() {
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [replaceDialog, setReplaceDialog] = useState({ open: false, activity: null, entries: [] });
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const queryClient = useQueryClient();

  const { data: activityTypes = [], isLoading } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: () => base44.entities.ActivityType.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ActivityType.create(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activityTypes"] });
      setNewName("");
      toast.success("Atividade criada!");
      logAction({ action: `Criou tipo de atividade "${variables?.name || ""}"`, category: "atividade" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ActivityType.delete(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["activityTypes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduleEntries"] });
      toast.success("Atividade removida!");
      const at = activityTypes.find(a => a.id === deletedId);
      logAction({ action: `Excluiu tipo de atividade "${at?.name || ""}"`, category: "atividade" });
    },
  });

  const handleDeleteClick = async (activity) => {
    // Find scheduled entries using this activity
    const allEntries = await base44.entities.ScheduleEntry.filter({ activity: activity.name });
    const scheduledEntries = allEntries.filter((e) => e.status === "agendado");

    if (scheduledEntries.length === 0) {
      // No affected scheduled entries — just confirm and delete
      setConfirmDelete(activity);
    } else {
      // Show replacement dialog
      setReplaceDialog({ open: true, activity, entries: scheduledEntries });
    }
  };

  const handleReplaceAndDelete = async (replacements) => {
    setIsProcessing(true);
    const activity = replaceDialog.activity;
    // Update each affected entry with new activity
    for (const [entryId, newActivity] of Object.entries(replacements)) {
      await base44.entities.ScheduleEntry.update(entryId, { activity: newActivity });
    }
    // Delete the activity type
    await base44.entities.ActivityType.delete(activity.id);
    queryClient.invalidateQueries({ queryKey: ["activityTypes"] });
    queryClient.invalidateQueries({ queryKey: ["scheduleEntries"] });
    setIsProcessing(false);
    setReplaceDialog({ open: false, activity: null, entries: [] });
    toast.success(`Atividade "${activity.name}" excluída e ${Object.keys(replacements).length} entradas atualizadas!`);
    logAction({ action: `Excluiu tipo "${activity.name}" e substituiu ${Object.keys(replacements).length} agendamentos`, category: "atividade" });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMut.mutate({ name: newName.trim() });
  };

  const handleEditSave = async (activity) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === activity.name) {
      setEditingId(null);
      return;
    }
    setIsProcessing(true);
    const oldName = activity.name;
    // 1. Update the ActivityType entity
    await base44.entities.ActivityType.update(activity.id, { name: trimmed });
    // 2. Update all ScheduleEntry records that use the old name
    const entries = await base44.entities.ScheduleEntry.filter({ activity: oldName });
    for (const entry of entries) {
      await base44.entities.ScheduleEntry.update(entry.id, { activity: trimmed });
    }
    // 3. Update client monthly_activities and branch monthly_activities
    const allClients = await base44.entities.Client.list();
    for (const client of allClients) {
      let changed = false;
      const updatedActivities = (client.monthly_activities || []).map((a) => {
        if (a.activity_type === oldName) { changed = true; return { ...a, activity_type: trimmed }; }
        return a;
      });
      const updatedBranches = (client.branches || []).map((b) => {
        const updatedBA = (b.monthly_activities || []).map((a) => {
          if (a.activity_type === oldName) { changed = true; return { ...a, activity_type: trimmed }; }
          return a;
        });
        return { ...b, monthly_activities: updatedBA };
      });
      if (changed) {
        await base44.entities.Client.update(client.id, { monthly_activities: updatedActivities, branches: updatedBranches });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["activityTypes"] });
    queryClient.invalidateQueries({ queryKey: ["scheduleEntries"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setIsProcessing(false);
    setEditingId(null);
    toast.success(`Atividade renomeada de "${oldName}" para "${trimmed}" em todos os locais!`);
    logAction({ action: `Renomeou atividade "${oldName}" para "${trimmed}"`, category: "atividade" });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tipos de Atividade</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os tipos de atividade disponíveis</p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Adicionar Nova Atividade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da atividade..."
              className="flex-1"
            />
            <Button type="submit" disabled={!newName.trim() || createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-sm font-medium">
            Atividades Cadastradas ({activityTypes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : activityTypes.length === 0 ? (
            <div className="p-8 text-center">
              <Tag className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activityTypes.map((at) => (
                <div key={at.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors group">
                  {editingId === at.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleEditSave(at); }} className="flex items-center gap-2 flex-1 mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        disabled={isProcessing}
                      />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)} disabled={isProcessing}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/60" />
                        <span className="text-sm">{at.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          onClick={() => { setEditingId(at.id); setEditingName(at.name); }}
                          disabled={deleteMut.isPending || isProcessing}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteClick(at)}
                          disabled={deleteMut.isPending || isProcessing}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Excluir atividade"
        description={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Nenhuma atividade agendada será afetada.`}
        onConfirm={() => { deleteMut.mutate(confirmDelete.id); setConfirmDelete(null); }}
      />
      <ReplaceActivityDialog
        open={replaceDialog.open}
        onOpenChange={(v) => { if (!v) setReplaceDialog({ open: false, activity: null, entries: [] }); }}
        activityToDelete={replaceDialog.activity}
        affectedEntries={replaceDialog.entries}
        availableActivities={activityTypes}
        onConfirm={handleReplaceAndDelete}
        isProcessing={isProcessing}
      />
    </div>
  );
}