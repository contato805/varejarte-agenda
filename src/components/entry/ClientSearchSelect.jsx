import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, X } from "lucide-react";

export default function ClientSearchSelect({ clients = [], value, clientBranch, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Build flat list of options: client or client — branch, sorted A-Z
  const options = useMemo(() => {
    const items = [];
    const sorted = [...clients].filter(cl => cl.active !== false).sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
    sorted.forEach((cl) => {
      const activeBranches = (cl.branches || []).filter(b => b.active !== false && b.name);
      if (activeBranches.length > 0) {
        activeBranches
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          .forEach((branch) => {
            items.push({
              key: `${cl.id}::${branch.name}`,
              clientId: cl.id,
              branchName: branch.name,
              label: `${cl.company_name} — ${branch.name}`,
            });
          });
      } else {
        items.push({
          key: cl.id,
          clientId: cl.id,
          branchName: "",
          label: cl.company_name,
        });
      }
    });
    return items;
  }, [clients]);

  // Current display label
  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const match = options.find(o => o.clientId === value && o.branchName === (clientBranch || ""));
    return match?.label || "";
  }, [value, clientBranch, options]);

  // Filtered options
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(term));
  }, [options, search]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (option) => {
    onChange(option.clientId, option.branchName);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", "");
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / display */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center justify-between w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent cursor-pointer"
      >
        <span className={selectedLabel ? "text-foreground truncate text-xs" : "text-muted-foreground text-xs"}>
          {selectedLabel || "Selecione..."}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={handleClear} className="p-0.5 rounded hover:bg-muted">
              <X className="w-3 h-3 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou filial..."
                className="h-8 pl-7 text-xs"
                autoFocus
              />
            </div>
          </div>
          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum resultado</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${
                    opt.clientId === value && opt.branchName === (clientBranch || "") ? "bg-accent font-medium" : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}