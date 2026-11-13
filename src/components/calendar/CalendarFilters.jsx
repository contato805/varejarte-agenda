import React, { useState, useRef, useEffect } from "react";
import { Filter, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

function MultiSelect({ label, options, selected = [], onChange, colorKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSelected = selected.length === 0;
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  const clearAll = (e) => { e.stopPropagation(); onChange([]); };
  const displayLabel = allSelected
    ? `Todos ${label}`
    : selected.length === 1
    ? options.find((o) => o.id === selected[0])?.label || label
    : `${selected.length} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium transition-colors hover:bg-accent min-w-[160px] max-w-[200px]",
          open && "ring-2 ring-ring"
        )}
      >
        <span className="flex-1 text-left truncate text-muted-foreground">{displayLabel}</span>
        {!allSelected && (
          <span onClick={clearAll} className="ml-1 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-[220px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-[220px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors", allSelected && "bg-accent/60 font-semibold")}
            >
              <Check className={cn("w-3.5 h-3.5 text-primary", !allSelected && "opacity-0")} />
              Todos {label}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            {options.map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors", isSelected && "bg-accent/40")}
                >
                  <Check className={cn("w-3.5 h-3.5 text-primary", !isSelected && "opacity-0")} />
                  {colorKey && opt.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                  )}
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientMultiSelect({ label, clients, selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build grouped list: clients sorted by name, each with branches
  const sortedClients = [...clients].sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));

  // Flat list of all selectable IDs: "client:ID" for the client itself, "branch:clientID:branchIdx" for branches
  // We use composite keys: client without branches = "c:{id}", client with branches header = "c:{id}", branch = "b:{id}:{idx}"
  const buildKey = (clientId, branchIdx) => branchIdx !== undefined ? `b:${clientId}:${branchIdx}` : `c:${clientId}`;

  const allSelected = selected.length === 0;

  const isSelected = (key) => selected.includes(key);

  const toggle = (key) => {
    onChange(selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key]);
  };

  // Toggle all branches of a client (+ client key itself)
  const toggleClient = (client) => {
    const branches = (client.branches || []).filter(br => br.active !== false);
    if (branches.length === 0) {
      // No branches — just toggle the client key
      toggle(buildKey(client.id));
      return;
    }
    const clientKey = buildKey(client.id);
    const branchKeys = branches.map((_, idx) => buildKey(client.id, idx));
    const allKeys = [clientKey, ...branchKeys];
    const allCurrentlySelected = allKeys.every(k => selected.includes(k));
    if (allCurrentlySelected) {
      onChange(selected.filter(k => !allKeys.includes(k)));
    } else {
      onChange([...new Set([...selected, ...allKeys])]);
    }
  };

  const clearAll = (e) => { e.stopPropagation(); onChange([]); };

  // Display label
  const displayLabel = allSelected
    ? `Todos ${label}`
    : selected.length === 1
    ? (() => {
        const key = selected[0];
        if (key.startsWith("c:")) {
          const cid = key.slice(2);
          return clients.find(c => c.id === cid)?.company_name || label;
        }
        if (key.startsWith("b:")) {
          const [, cid, idx] = key.split(":");
          const cl = clients.find(c => c.id === cid);
          const br = cl?.branches?.[Number(idx)];
          return br?.name || cl?.company_name || label;
        }
        return label;
      })()
    : `${selected.length} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium transition-colors hover:bg-accent min-w-[160px] max-w-[200px]",
          open && "ring-2 ring-ring"
        )}
      >
        <span className="flex-1 text-left truncate text-muted-foreground">{displayLabel}</span>
        {!allSelected && (
          <span onClick={clearAll} className="ml-1 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-[260px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors", allSelected && "bg-accent/60 font-semibold")}
            >
              <Check className={cn("w-3.5 h-3.5 text-primary", !allSelected && "opacity-0")} />
              Todos {label}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            {sortedClients.map((client) => {
              const branches = (client.branches || []).filter(br => br.active !== false);
              const hasBranches = branches.length > 0;
              const clientKey = buildKey(client.id);

              if (!hasBranches) {
                const sel = isSelected(clientKey);
                return (
                  <button
                    key={clientKey}
                    type="button"
                    onClick={() => toggle(clientKey)}
                    className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors", sel && "bg-accent/40")}
                  >
                    <Check className={cn("w-3.5 h-3.5 text-primary", !sel && "opacity-0")} />
                    <span className="truncate">{client.company_name}</span>
                  </button>
                );
              }

              // Client with branches
              const branchKeys = branches.map((_, idx) => buildKey(client.id, idx));
              const allBranchSelected = [clientKey, ...branchKeys].every(k => selected.includes(k));
              const someBranchSelected = [clientKey, ...branchKeys].some(k => selected.includes(k));

              return (
                <div key={clientKey}>
                  <button
                    type="button"
                    onClick={() => toggleClient(client)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-accent transition-colors bg-muted/40 border-b border-border/50",
                      allBranchSelected && "bg-accent/50"
                    )}
                  >
                    <Check className={cn("w-3.5 h-3.5 text-primary", !someBranchSelected && "opacity-0", someBranchSelected && !allBranchSelected && "opacity-50")} />
                    <span className="truncate">{client.company_name}</span>
                  </button>
                  {branches.map((br, idx) => {
                    const brKey = buildKey(client.id, idx);
                    const sel = isSelected(brKey);
                    return (
                      <button
                        key={brKey}
                        type="button"
                        onClick={() => toggle(brKey)}
                        className={cn("w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs hover:bg-accent transition-colors", sel && "bg-accent/40")}
                      >
                        <Check className={cn("w-3 h-3 text-primary", !sel && "opacity-0")} />
                        <span className="truncate text-muted-foreground">{br.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarFilters({ employees, clients, filters, onFilterChange }) {
  const empOptions = employees.map((e) => ({ id: e.id, label: e.name, color: e.color }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="text-xs font-medium">Filtros:</span>
      </div>
      <MultiSelect
        label="Colaboradores"
        options={empOptions}
        selected={filters.employees}
        onChange={(v) => onFilterChange({ ...filters, employees: v })}
        colorKey
      />
      <ClientMultiSelect
        label="Clientes"
        clients={clients}
        selected={filters.clients}
        onChange={(v) => onFilterChange({ ...filters, clients: v })}
      />
    </div>
  );
}