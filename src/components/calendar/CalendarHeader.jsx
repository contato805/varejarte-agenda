import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function CalendarHeader({ currentDate, onPrev, onNext, onToday, view, onViewChange, onCustomDateRange }) {
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));

  const handleFilter = () => {
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const fmt = (d) => format(d, "yyyy-MM-dd");
    onCustomDateRange && onCustomDateRange(fmt(start), fmt(end));
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-foreground capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </h2>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Month/Year selectors + Filter button */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="h-8 w-[80px] text-xs">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleFilter}>
          <Search className="w-3.5 h-3.5" />
          Filtrar
        </Button>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {["month", "day"].map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "month" ? "Mês" : "Diário"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}