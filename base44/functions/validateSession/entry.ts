import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, employeeId } = await req.json();

    if (!token || !employeeId) {
      return Response.json({ valid: false }, { status: 401 });
    }

    const employees = await base44.asServiceRole.entities.Employee.filter({ active: true });
    const emp = employees.find(e => e.id === employeeId);

    if (!emp || emp.session_token !== token) {
      return Response.json({ valid: false }, { status: 401 });
    }

    // Check expiration
    if (emp.session_expires && new Date(emp.session_expires) < new Date()) {
      return Response.json({ valid: false, reason: 'expired' }, { status: 401 });
    }

    return Response.json({
      valid: true,
      session: {
        id: emp.id,
        name: emp.name,
        access_type: emp.access_type || 'viewer',
        color: emp.color,
      }
    });
  } catch (error) {
    console.error('Validate session error:', error.message);
    return Response.json({ valid: false }, { status: 500 });
  }
});