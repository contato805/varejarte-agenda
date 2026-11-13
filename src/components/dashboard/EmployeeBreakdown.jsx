import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 5;

export default function EmployeeBreakdown({ employees, entries }) {
  const [page, setPage] = useState(0);

  const breakdown = employees.map((emp) => {
    const count = entries.filter((e) => e.employee_id === emp.id).length;
    return { ...emp, count };
  }).sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);
  const totalPages = Math.ceil(breakdown.length / PAGE_SIZE);
  const paged = breakdown.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Por Colaborador</CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-muted-foreground">{page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paged.map((emp) => (
            <div key={emp.id} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{emp.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{emp.count} ativ.</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(emp.count / maxCount) * 100}%`, backgroundColor: emp.color }}
                  />
                </div>
              </div>
            </div>
          ))}
          {breakdown.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum colaborador cadastrado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}