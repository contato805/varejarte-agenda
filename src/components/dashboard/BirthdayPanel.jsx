import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Cake } from "lucide-react";

function getDaysUntilBirthday(day, month) {
  const today = new Date();
  const thisYear = today.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  if (next < today) next = new Date(thisYear + 1, month - 1, day);
  const diff = Math.round((next - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatBirthday(day, month) {
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${day} de ${months[month - 1]}`;
}

export default function BirthdayPanel({ clients = [], employees = [] }) {
  const clientBirthdays = useMemo(() => {
    const list = [];
    clients.forEach(client => {
      (client.contacts || []).forEach(contact => {
        if (contact.birthday_day && contact.birthday_month) {
          const days = getDaysUntilBirthday(contact.birthday_day, contact.birthday_month);
          if (days <= 90) {
            list.push({
              name: contact.name,
              company: client.company_name,
              day: contact.birthday_day,
              month: contact.birthday_month,
              daysUntil: days,
            });
          }
        }
      });
    });
    return list.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [clients]);

  const employeeBirthdays = useMemo(() => {
    const list = [];
    employees.forEach(emp => {
      if (emp.birthday_day && emp.birthday_month) {
        const days = getDaysUntilBirthday(emp.birthday_day, emp.birthday_month);
        if (days <= 90) {
          list.push({
            name: emp.name,
            color: emp.color,
            day: emp.birthday_day,
            month: emp.birthday_month,
            daysUntil: days,
          });
        }
      }
    });
    return list.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Clientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-500" />
            Aniversários de Clientes — próximos 90 dias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientBirthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum aniversário nos próximos 90 dias.</p>
          ) : (
            <ul className="divide-y divide-border max-h-64 overflow-y-auto">
              {clientBirthdays.map((b, i) => (
                <li key={i} className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-pink-600">{formatBirthday(b.day, b.month)}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.daysUntil === 0 ? "🎂 Hoje!" : `em ${b.daysUntil} dias`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Colaboradores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cake className="w-4 h-4 text-purple-500" />
            Aniversários de Colaboradores — próximos 90 dias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {employeeBirthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum aniversário nos próximos 90 dias.</p>
          ) : (
            <ul className="divide-y divide-border max-h-64 overflow-y-auto">
              {employeeBirthdays.map((b, i) => (
                <li key={i} className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color || "#8b5cf6" }} />
                    <p className="text-sm font-medium">{b.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-purple-600">{formatBirthday(b.day, b.month)}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.daysUntil === 0 ? "🎂 Hoje!" : `em ${b.daysUntil} dias`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}