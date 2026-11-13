import { api } from '@/api/client';

export function logAction({ action, category, details }) {
  // Identity is assigned by the server, never by a browser-supplied name.
  return api.entities.AuditLog.create({ action, category, details: details || '' });
}
