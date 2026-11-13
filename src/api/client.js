import { createClient } from '@supabase/supabase-js';
import { resolveConfig } from './config.js';
import { createAgendaClient } from './agenda-client.js';

let instance;
export let configurationError = null;
try {
  const config = resolveConfig(import.meta.env);
  instance = createAgendaClient(createClient(config.url, config.key, {
    auth: { storageKey: config.storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }));
} catch (error) { configurationError = error.message; }

// No legacy fallback: absent/incorrect project configuration fails before any request.
export const api = instance;
