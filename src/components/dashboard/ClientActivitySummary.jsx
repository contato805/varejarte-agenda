import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Clock, Eye, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function getStatus(entry) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (entry.date < today) return "concluido";
  if (entry.date === today) return "pendente";
  return "futuro";
}

const STATUS_CONFIG = {
  concluido: { label: "Concluído", icon: CheckCircle2, className: "text-green-600 bg-green-50" },
  pendente: { label: "Pendente", icon: Timer, className: "text-amber-600 bg-amber-50" },
  futuro: { label: "Agendado", icon: AlertCircle, className: "text-blue-600 bg-blue-50" },
};

function ActivityMetricDot({ actual, expected }) {
  if (expected == null || expected === 0) return null;
  if (actual < expected) return <span className="w-3 h-3 rounded-full bg-red-500 inline-block flex-shrink-0" title={`${actual}/${expected} — abaixo do esperado`} />;
  if (actual === expected) return <span className="w-3 h-3 rounded-full bg-green-500 inline-block flex-shrink-0" title={`${actual}/${expected} — dentro do esperado`} />;
  return <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block flex-shrink-0" title={`${actual}/${expected} — acima do esperado`} />;
}

function ClientDetailModal({ client, onClose }) {
  if (!client) return null;
  const sorted = [...client.entries].sort((a, b) => a.date.localeCompare(b.date));
  const breakdown = {};
  client.entries.forEach((e) => {
    const k = e.activity || "Sem tipo";
    if (!breakdown[k]) breakdown[k] = { count: 0, hours: 0 };
    breakdown[k].count++;
    breakdown[k].hours += calcHours(e.start_time, e.end_time);
  });

  // Map expected quantities from the branch-specific planned activities
  const expectedMap = {};
  (client.plannedActivities || []).forEach((ma) => {
    if (ma.activity_type) {
      expectedMap[ma.activity_type] = (expectedMap[ma.activity_type] || 0) + (ma.quantity || 0);
    }
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {client.name}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <p className="text-2xl font-bold text-foreground">{client.entries.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Atividades</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <p className="text-2xl font-bold text-foreground">{client.totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total horas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <p className="text-2xl font-bold text-foreground">
              {client.entries.filter(e => getStatus(e) === "concluido").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Concluídas</p>
          </div>
        </div>

        {/* Activity breakdown */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Por tipo de atividade</p>

          {/* Contracted activities */}
          <div className="space-y-1.5">
            {/* Contracted with entries */}
            {Object.entries(breakdown)
              .filter(([act]) => expectedMap[act] != null)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([act, data]) => {
                const actual = data.count;
                const expected = expectedMap[act];
                const bg = actual < expected ? "bg-red-500" : actual === expected ? "bg-green-500" : "bg-yellow-400";
                return (
                  <div key={act} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                    <span>{act}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="font-medium text-foreground">{data.hours.toFixed(1)}h</span>
                      <span className={`${bg} text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0`}>
                        {actual}/{expected}
                      </span>
                    </div>
                  </div>
                );
              })}
            {/* Contracted with zero occurrences */}
            {(client.plannedActivities || [])
              .filter((ma) => ma.activity_type && !breakdown[ma.activity_type])
              .map((ma) => (
                <div key={ma.activity_type} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                  <span>{ma.activity_type}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="font-medium text-foreground">0.0h</span>
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      0/{ma.quantity || 0}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Extra activities (not in contract) */}
          {Object.entries(breakdown).filter(([act]) => expectedMap[act] == null).length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1.5 text-center">Atividades complementares</p>
              <div className="space-y-1.5">
                {Object.entries(breakdown)
                  .filter(([act]) => expectedMap[act] == null)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([act, data]) => (
                    <div key={act} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                      <span>{act}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="font-medium text-foreground">{data.hours.toFixed(1)}h</span>
                        <span className="bg-muted text-muted-foreground text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                          {data.count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* All entries */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Histórico de atividades</p>
          <div className="space-y-2">
            {sorted.map((e, i) => {
              const status = getStatus(e);
              const { label, icon: StatusIcon, className: stCls } = STATUS_CONFIG[status];
              return (
                <div key={i} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{e.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.date ? format(parseISO(e.date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      {e.start_time && e.end_time ? ` · ${e.start_time}–${e.end_time}` : ""}
                      {" · "}{e.employee_name}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${stCls}`}>
                    <StatusIcon className="w-3 h-3" />
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientActivitySummary({ entries, clients }) {
  const [detailClient, setDetailClient] = useState(null);

  // Pré-construir mapa de nome de filial → { companyName, branch }
  const branchLookup = {};
  clients.forEach((c) => {
    if (!c.branches?.length) return;
    c.branches.forEach((b) => {
      if (b.name && b.active !== false) {
        branchLookup[b.name] = { companyName: c.company_name, branch: b, clientData: c };
      }
    });
  });

  const clientMap = {};
  entries.forEach((e) => {
    if (!e.client_id) return;
    const displayName = e.client_name || "Desconhecido";
    const key = `${e.client_id}::${displayName}`;
    if (!clientMap[key]) {
      // Tentar achar o cliente pelo ID
      let clientData = clients.find((c) => c.id === e.client_id);
      let branch = clientData?.branches?.find(b => b.name === displayName && b.active !== false);

      // Se não achou filial pelo ID, buscar pelo nome em todos os clientes
      if (!branch && branchLookup[displayName]) {
        const lookup = branchLookup[displayName];
        branch = lookup.branch;
        if (!clientData) clientData = lookup.clientData;
      }

      const branchActivities = branch?.monthly_activities || [];
      const plannedActivities = branchActivities.length > 0
        ? branchActivities
        : (!clientData?.branches?.length ? (clientData?.monthly_activities || []) : []);

      const companyName = branch
        ? (branchLookup[displayName]?.companyName || clientData?.company_name || displayName)
        : (clientData?.company_name || displayName);
      const isBranch = companyName !== displayName;

      clientMap[key] = {
        id: e.client_id,
        name: displayName,
        companyName,
        branchName: isBranch ? displayName : null,
        clientData: clientData || null,
        plannedActivities,
        entries: [],
        totalHours: 0,
      };
    }
    clientMap[key].entries.push(e);
    clientMap[key].totalHours += calcHours(e.start_time, e.end_time);
  });

  // Ensure all active clients/branches appear even without entries
  clients.filter(c => c.active !== false).forEach(c => {
    const branches = (c.branches || []).filter(b => b.active !== false && b.name);
    if (branches.length > 0) {
      branches.forEach(b => {
        const key = `${c.id}::${b.name}`;
        if (!clientMap[key]) {
          clientMap[key] = {
            id: c.id,
            name: b.name,
            companyName: c.company_name,
            branchName: b.name,
            clientData: c,
            plannedActivities: b.monthly_activities || [],
            entries: [],
            totalHours: 0,
          };
        }
      });
    } else {
      const key = `${c.id}::${c.company_name}`;
      if (!clientMap[key]) {
        clientMap[key] = {
          id: c.id,
          name: c.company_name,
          companyName: c.company_name,
          branchName: null,
          clientData: c,
          plannedActivities: c.monthly_activities || [],
          entries: [],
          totalHours: 0,
        };
      }
    }
  });

  const sorted = Object.values(clientMap).sort((a, b) => {
    const cmp = a.companyName.localeCompare(b.companyName, 'pt-BR');
    if (cmp !== 0) return cmp;
    return (a.branchName || "").localeCompare(b.branchName || "", 'pt-BR');
  });

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Resumo por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma atividade no período
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map((client) => {
                const last3 = [...client.entries]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 3);
                const visits = client.entries.filter(e =>
                  e.activity?.toLowerCase().includes("visita")
                ).length;
                const concluded = client.entries.filter(e => getStatus(e) === "concluido").length;
                const pending = client.entries.filter(e => getStatus(e) === "pendente").length;

                return (
                  <div key={`${client.id}-${client.name}`} className="border border-border rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          {client.branchName ? (
                            <>
                              <p className="text-sm font-semibold leading-tight">{client.branchName}</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">{client.companyName}</p>
                            </>
                          ) : (
                            <p className="text-sm font-semibold leading-tight">{client.companyName}</p>
                          )}
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{client.entries.length} atividades</span>
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {client.totalHours.toFixed(1)}h
                            </span>
                            {visits > 0 && (
                              <span className="text-xs text-muted-foreground">{visits} visita{visits !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Status badges */}
                      <div className="flex items-center gap-1.5">
                        {concluded > 0 && (
                          <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium text-green-600 bg-green-50">
                            <CheckCircle2 className="w-3 h-3" />{concluded}
                          </span>
                        )}
                        {pending > 0 && (
                          <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium text-amber-600 bg-amber-50">
                            <Timer className="w-3 h-3" />{pending}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Atividades Previstas */}
                    {client.plannedActivities.length > 0 && (
                      <div className="px-4 py-2 space-y-1 border-b border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Atividades Previstas</p>
                        {client.plannedActivities.map((act, i) => {
                          const type = act.activity_type;
                          const total = act.quantity || 0;
                          const scheduled = client.entries.filter(e => (e.activity || "").toLowerCase() === (type || "").toLowerCase()).length;
                          const ratio = total > 0 ? scheduled / total : 0;
                          const badgeColor = scheduled < total ? "bg-red-100 text-red-600" : scheduled === total ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
                          return (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="truncate text-foreground">{type}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeColor}`}>
                                {scheduled}/{total}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Separator */}
                    <div className="mx-4 border-t border-dashed border-border" />

                    {/* Last 3 activities */}
                    <div className="px-4 py-2 space-y-1.5">
                      {last3.map((e, i) => {
                        const status = getStatus(e);
                        const { label, icon: StatusIcon, className: stCls } = STATUS_CONFIG[status];
                        return (
                          <div key={i} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: e.employee_color || "#6366f1" }}
                              />
                              <span className="truncate text-foreground">{e.activity}</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {e.date ? format(parseISO(e.date), "dd/MM") : "-"} · {e.employee_name}
                              </span>
                            </div>
                            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${stCls}`}>
                              <StatusIcon className="w-2.5 h-2.5" />{label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ver mais */}
                    <div className="px-4 pb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-primary hover:text-primary hover:bg-primary/5"
                        onClick={() => setDetailClient(client)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver mais
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {detailClient && (
        <ClientDetailModal client={detailClient} onClose={() => setDetailClient(null)} />
      )}
    </>
  );
}