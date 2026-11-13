import { base44 } from "@/api/base44Client";

export async function logAction({ action, category, details }) {
  let userName = "Sistema";
  try {
    const raw = sessionStorage.getItem("employeeSession");
    if (raw) {
      const session = JSON.parse(raw);
      userName = session.name || "Colaborador";
    } else {
      const user = await base44.auth.me();
      userName = user?.full_name || "Admin";
    }
  } catch {
    userName = "Desconhecido";
  }
  
  return base44.entities.AuditLog.create({
    action,
    category,
    user_name: userName,
    details: details || "",
  });
}