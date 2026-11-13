import React from "react";

export default function EmployeeLegend({ employees }) {
  if (!employees.length) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Legenda — Colaboradores</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: emp.color }}
            />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {emp.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}