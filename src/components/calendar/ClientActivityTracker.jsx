import React, { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, ChevronDown, ChevronUp, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

function ContractBadge({ scheduled, contracted }) {
  const color = scheduled < contracted ? "bg-red-100 text-red-600" :
                scheduled === contracted ? "bg-emerald-100 text-emerald-700" :
                "bg-amber-100 text-amber-700";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", color)}>
      {scheduled}/{contracted}
    </span>
  );
}

function CompletedBadge({ completed, total }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
      ✓ {completed}/{total}
    </span>
  );
}

function ActivityRow({ activityType, done, total }) {
  const color = done < total ? "bg-red-100 text-red-600" :
                done === total ? "bg-emerald-100 text-emerald-700" :
                "bg-amber-100 text-amber-700";
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-foreground truncate mr-2">{activityType}</span>
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", color)}>
        {done}/{total}
      </span>
    </div>
  );
}

function BranchCard({ item, monthEntries }) {
  const [expanded, setExpanded] = useState(false);

  const clientEntries = useMemo(() => {
    if (item.isBranch) {
      return monthEntries.filter(e => {
        if (e.client_id !== item.clientId) return false;
        const name = (e.client_name || "").toLowerCase();
        return name.includes(item.branchName.toLowerCase());
      });
    }
    return monthEntries.filter(e => e.client_id === item.clientId);
  }, [monthEntries, item]);

  const plannedActivities = item.activities || [];

  // Only count contracted activity types for the contract badge
  const totalContracted = useMemo(() =>
    plannedActivities.reduce((sum, a) => sum + (a.quantity || 0), 0),
    [plannedActivities]
  );

  const contractedTypes = useMemo(() =>
    new Set(plannedActivities.map(a => a.activity_type)),
    [plannedActivities]
  );

  const totalScheduledContracted = useMemo(() =>
    clientEntries.filter(e => contractedTypes.has(e.activity)).length,
    [clientEntries, contractedTypes]
  );

  const totalScheduled = clientEntries.length;
  const totalCompleted = clientEntries.filter(e => e.status === "realizado").length;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {item.isBranch ? (
            <GitBranch className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <div className="text-left min-w-0">
            <span className="font-semibold text-sm truncate block">
              {item.isBranch ? item.branchName : item.companyName}
            </span>
            {item.isBranch && (
              <span className="text-[11px] text-muted-foreground truncate block">{item.companyName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ContractBadge scheduled={totalScheduledContracted} contracted={totalContracted} />
          <CompletedBadge completed={totalCompleted} total={totalScheduled} />
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (() => {
        // Atividades complementares: agendadas mas não previstas em contrato
        const extraActivities = (() => {
          const counts = {};
          clientEntries.forEach(e => {
            if (!contractedTypes.has(e.activity)) {
              counts[e.activity] = (counts[e.activity] || 0) + 1;
            }
          });
          return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
        })();

        return (
          <div className="space-y-1 pt-1">
            {plannedActivities.length > 0 && (
              <>
                {plannedActivities.map((act, i) => {
                  const count = clientEntries.filter(e => e.activity === act.activity_type).length;
                  return (
                    <ActivityRow
                      key={i}
                      activityType={act.activity_type}
                      done={count}
                      total={act.quantity || 0}
                    />
                  );
                })}
              </>
            )}
            {extraActivities.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-dashed border-border space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Complementares</span>
                {extraActivities.map(([activity, count]) => (
                  <div key={activity} className="flex items-center justify-between text-xs py-1">
                    <span className="text-foreground truncate mr-2">{activity}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default function ClientActivityTracker({ clients, entries, currentDate, filters = {} }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthStr = format(currentDate, "MMMM yyyy", { locale: ptBR });

  // Extract selected client IDs from composite filter keys
  const selectedClientIds = useMemo(() => {
    if (!filters.clients || filters.clients.length === 0) return [];
    return [...new Set(filters.clients.map(k => {
      if (k.startsWith("c:")) return k.slice(2);
      if (k.startsWith("b:")) return k.split(":")[1];
      return k;
    }))];
  }, [filters.clients]);

  const selectedEmployeeIds = filters.employees || [];

  const monthEntries = useMemo(() => {
    const start = format(monthStart, "yyyy-MM-dd");
    const end = format(monthEnd, "yyyy-MM-dd");
    let result = entries.filter(e => e.date >= start && e.date <= end && e.status !== "cancelado");
    if (selectedEmployeeIds.length > 0) {
      result = result.filter(e => selectedEmployeeIds.includes(e.employee_id));
    }
    if (selectedClientIds.length > 0) {
      result = result.filter(e => selectedClientIds.includes(e.client_id));
    }
    return result;
  }, [entries, monthStart, monthEnd, selectedEmployeeIds, selectedClientIds]);

  // Build flat list: one item per branch (or per client if no branches)
  const items = useMemo(() => {
    const list = [];
    const activeClients = clients.filter(c => c.active !== false && (selectedClientIds.length === 0 || selectedClientIds.includes(c.id)));
    activeClients.forEach(c => {
      const branches = (c.branches || []).filter(b => b.active !== false && b.name);
      if (branches.length > 0) {
        branches.forEach(b => {
          list.push({
            clientId: c.id,
            companyName: c.company_name,
            branchName: b.name,
            isBranch: true,
            activities: b.monthly_activities || [],
          });
        });
      } else {
        list.push({
          clientId: c.id,
          companyName: c.company_name,
          branchName: null,
          isBranch: false,
          activities: c.monthly_activities || [],
        });
      }
    });

    list.sort((a, b) => {
      const cmp = (a.companyName || "").localeCompare(b.companyName || "", "pt-BR");
      if (cmp !== 0) return cmp;
      return (a.branchName || "").localeCompare(b.branchName || "", "pt-BR");
    });

    return list;
  }, [clients, selectedClientIds]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground capitalize">
          Atividades Previstas — {monthStr}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <BranchCard
            key={`${item.clientId}-${item.branchName || "main"}-${i}`}
            item={item}
            monthEntries={monthEntries}
          />
        ))}
      </div>
    </div>
  );
}