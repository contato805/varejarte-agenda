export function resolveConfig(env) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const projectRef = env.VITE_SUPABASE_PROJECT_REF?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !projectRef || !key) throw new Error('O ambiente do Varejarte ainda não foi configurado.');
  const parsed = new URL(url);
  const local = parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname) && projectRef === 'local-varejarte';
  const hosted = parsed.protocol === 'https:' && /^[a-z]{20}$/.test(projectRef) && parsed.hostname === `${projectRef}.supabase.co`;
  if ((!local && !hosted) || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error('O destino configurado não corresponde ao projeto do Varejarte.');
  }
  let publicKey = key.startsWith('sb_publishable_');
  if (key.startsWith('eyJ')) {
    try { publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; }
    catch { publicKey = false; }
  }
  if (!publicKey) throw new Error('Somente a chave pública do projeto pode ser usada neste aplicativo.');
  return { url: parsed.origin, key, projectRef, storageKey: `varejarte:${projectRef}:auth` };
}
