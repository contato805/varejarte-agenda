import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export default function ReplaceActivityDialog({
  open,
  onOpenChange,
  activityToDelete,
  affectedEntries,
  availableActivities,
  onConfirm,
  isProcessing,
}) {
  const [mode, setMode] = useState("global"); // "global" | "individual"
  const [globalReplacement, setGlobalReplacement] = useState("");
  const [individualReplacements, setIndividualReplacements] = useState({});

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setMode("global");
      setGlobalReplacement("");
      setIndividualReplacements({});
    }
  }, [open]);

  const otherActivities = useMemo(
    () => availableActivities.filter((a) => a.name !== activityToDelete?.name),
    [availableActivities, activityToDelete]
  );

  const allResolved = useMemo(() => {
    if (mode === "global") return !!globalReplacement;
    return affectedEntries.every((e) => !!individualReplacements[e.id]);
  }, [mode, globalReplacement, individualReplacements, affectedEntries]);

  const handleConfirm = () => {
    const replacements = {};
    if (mode === "global") {
      affectedEntries.forEach((e) => { replacements[e.id] = globalReplacement; });
    } else {
      affectedEntries.forEach((e) => { replacements[e.id] = individualReplacements[e.id]; });
    }
    onConfirm(replacements);
  };

  if (!activityToDelete) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir "{activityToDelete.name}"
          </DialogTitle>
          <DialogDescription>
            Existem <strong>{affectedEntries.length}</strong> atividades <strong>agendadas</strong> usando este tipo.
            Atividades já realizadas ou canceladas não serão afetadas.
            Escolha como deseja substituir:
          </DialogDescription>
        </DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-2">
          <Button
            variant={mode === "global" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("global")}
            className="flex-1"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Substituir todas
          </Button>
          <Button
            variant={mode === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("individual")}
            className="flex-1"
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            Escolher individual
          </Button>
        </div>

        {mode === "global" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Nova atividade para todas:</label>
            <Select value={globalReplacement} onValueChange={setGlobalReplacement}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a atividade substituta..." />
              </SelectTrigger>
              <SelectContent>
                {otherActivities.map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            <p className="text-xs text-muted-foreground mb-1">Selecione uma nova atividade para cada entrada:</p>
            {affectedEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{entry.client_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.employee_name || "—"} · {entry.date ? format(parseISO(entry.date), "dd/MM", { locale: ptBR }) : "—"} · {entry.start_time}–{entry.end_time}
                  </p>
                </div>
                <div className="w-40 shrink-0">
                  <Select
                    value={individualReplacements[entry.id] || ""}
                    onValueChange={(v) => setIndividualReplacements((prev) => ({ ...prev, [entry.id]: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Substituir por..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherActivities.map((a) => (
                        <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {individualReplacements[entry.id] && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!allResolved || isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Substituir e Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}