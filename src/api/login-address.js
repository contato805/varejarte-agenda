// Shared by the browser and employee provisioning function; no plaintext passwords stored here.
export async function loginAddress(login) {
  const normalized = String(login || '').normalize('NFKC').trim().toLowerCase();
  if (!normalized) throw new Error('Informe seu login.');
  if (normalized.includes('@')) return normalized;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hash}@login.varejarte.invalid`;
}
