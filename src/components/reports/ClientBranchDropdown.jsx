import React, { useState, useRef, useEffect, useMemo } from "react";
import { Building2, ChevronDown, Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Builds a flat list of unique client_name values from entries + client branches
function buildClientNameOptions(clients, entries) {
  const namesSet = new Set();

  // From entries — covers all names actually used in schedule
  entries.forEach((e) => {
    if (e.client_name) namesSet.add(e.client_name);
  });

  // From client branches — ensures new branches appear even without entries
  clients.forEach((c) => {
    const branches = (c.branches || []).filter((b) => b.active !== false && b.name);
    if (branches.length > 0) {
      branches.forEach((b) => namesSet.add(`${c.company_name} — ${b.name}`));
    } else {
      namesSet.add(c.company_name);
    }
  });

  return [...namesSet].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export default function ClientBranchDropdown({ clients, entries, selected, setSelected }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = useMemo(() => buildClientNameOptions(clients, entries), [clients, entries]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter((n) => n.toLowerCase().includes(term));
  }, [options, search]);

  const label = selected.length === 0
    ? "Todos os clientes"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`;

  const toggle = (name) => {
    setSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent transition-colors min-w-[180px] justify-between"
      >
        <span className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate max-w-[180px]">{label}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[280px] max-h-80 flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou filial..."
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            <button
              onClick={() => { setSelected([]); setOpen(false); setSearch(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.length === 0 ? "bg-emerald-600 border-emerald-600" : "border-border"}`}>
                {selected.length === 0 && <Check className="w-3 h-3 text-white" />}
              </div>
              Todos os clientes
            </button>
            <div className="border-t border-border my-1" />
            {filtered.map((name) => {
              const active = selected.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${active ? "bg-emerald-600 border-emerald-600" : "border-border"}`}>
                    {active && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}