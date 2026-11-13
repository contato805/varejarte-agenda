import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { login, password } = await req.json();

    if (!login || !password) {
      return Response.json({ error: 'Login e senha são obrigatórios' }, { status: 400 });
    }

    // Use service role to fetch employees — the caller is NOT authenticated (this is the login endpoint)
    const employees = await base44.asServiceRole.entities.Employee.filter({ active: true });

    const emp = employees.find(
      (e) => e.login && e.login.toLowerCase() === login.toLowerCase() && e.password === password
    );

    if (!emp) {
      return Response.json({ error: 'Login ou senha incorretos' }, { status: 401 });
    }

    // Generate a simple session token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const sessionToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.Employee.update(emp.id, {
      session_token: sessionToken,
      session_expires: expiresAt
    });

    return Response.json({
      success: true,
      session: {
        token: sessionToken,
        id: emp.id,
        name: emp.name,
        access_type: emp.access_type || 'viewer',
        color: emp.color,
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});