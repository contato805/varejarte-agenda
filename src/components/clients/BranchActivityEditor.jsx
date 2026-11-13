import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ListTodo, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";

export default function BranchActivityEditor({ activities = [], activityTypes = [], onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [newAct, setNewAct] = useState({ activity_type: "", quantity: "" });
  const [editIdx, setEditIdx] = useState(null);
  const [editAct, setEditAct] = useState({ activity_type: "", quantity: "" });

  const startEdit = (i) => {
    setEditIdx(i);
    setEditAct({ activity_type: activities[i].activity_type, quantity: activities[i].quantity || "" });
  };

  const saveEdit = () => {
    if (!editAct.activity_type) return;
    const updated = activities.map((a, i) => i === editIdx ? { ...a, ...editAct } : a);
    onChange(updated);
    setEditIdx(null);
  };

  const cancelEdit = () => setEditIdx(null);

  const addActivity = () => {
    if (!newAct.activity_type) return;
    onChange([...activities, { ...newAct }]);
    setNewAct({ activity_type: "", quantity: "" });
  };

  const removeActivity = (i) => {
    onChange(activities.filter((_, idx) => idx !== i));
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
      >
        <ListTodo className="w-3 h-3" />
        Atividades ({activities.length})
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 ml-2 pl-2 border-l-2 border-primary/20 space-y-2">
          {/* Existing activities */}
          {activities.map((act, i) => (
            editIdx === i ? (
              <div key={i} className="space-y-2 p-2 rounded border border-primary/40 bg-primary/5">
                <Select value={editAct.activity_type} onValueChange={(v) => setEditAct({ ...editAct, activity_type: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Tipo de atividade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((at) => {
                      const alreadyAdded = activities.some((a, idx) => a.activity_type === at.name && idx !== editIdx);
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
                  className="h-8 text-xs"
                  value={editAct.quantity}
                  onChange={(e) => setEditAct({ ...editAct, quantity: Number(e.target.value) })}
                  placeholder="Qtd"
                />
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="default" className="h-7 text-xs" onClick={saveEdit}>
                    <Check className="w-3 h-3 mr-1" /> Salvar
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit}>
                    <X className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded border border-border bg-muted/30 text-xs">
                <span className="font-medium">{act.activity_type}</span>
                <div className="flex items-center gap-2">
                  {act.quantity > 0 && <span className="text-muted-foreground">{act.quantity}×</span>}
                  <button type="button" onClick={() => startEdit(i)} className="text-primary hover:opacity-80">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => removeActivity(i)} className="text-destructive hover:opacity-80">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          ))}

          {/* Add new activity */}
          <div className="space-y-2 p-2 rounded border border-dashed border-primary/30 bg-primary/5">
            <Select
              value={newAct.activity_type}
              onValueChange={(v) => setNewAct({ ...newAct, activity_type: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipo de atividade..." />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((at) => {
                  const alreadyAdded = activities.some(a => a.activity_type === at.name);
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
              className="h-8 text-xs"
              value={newAct.quantity}
              onChange={(e) => setNewAct({ ...newAct, quantity: Number(e.target.value) })}
              placeholder="Qtd"
            />
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addActivity} disabled={!newAct.activity_type}>
              <Plus className="w-3 h-3 mr-1" /> Incluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}