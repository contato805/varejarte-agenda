import { format } from "date-fns";

/**
 * Normaliza o status das entries:
 * Atividades com data anterior a hoje que estão "agendado" (não canceladas) 
 * são tratadas como "realizado".
 */
export function normalizeEntryStatus(entries) {
  const today = format(new Date(), "yyyy-MM-dd");
  return entries.map(entry => {
    if (entry.date < today && entry.status === "agendado") {
      return { ...entry, status: "realizado" };
    }
    return entry;
  });
}