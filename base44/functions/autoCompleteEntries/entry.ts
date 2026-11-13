import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);
    console.log("Running autoCompleteEntries. Today:", today);

    const entries = await base44.asServiceRole.entities.ScheduleEntry.filter(
      { status: 'agendado' },
      '-date',
      5000
    );

    const pastEntries = entries.filter(e => e.date && e.date < today);
    console.log(`Found ${pastEntries.length} past agendado entries out of ${entries.length} total agendado`);

    const BATCH = 10;
    let updated = 0;
    for (let i = 0; i < pastEntries.length; i += BATCH) {
      const batch = pastEntries.slice(i, i + BATCH);
      await Promise.all(
        batch.map(entry =>
          base44.asServiceRole.entities.ScheduleEntry.update(entry.id, { status: 'realizado' })
        )
      );
      updated += batch.length;
    }

    console.log(`Updated ${updated} entries to realizado`);
    return Response.json({ updated, total_checked: entries.length });
  } catch (error) {
    console.error("Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});