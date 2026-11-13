import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data || !event?.entity_id) {
      return Response.json({ skipped: true, reason: 'no data' });
    }

    const clientId = event.entity_id;
    const client = data;

    // Get all schedule entries for this client
    const entries = await base44.asServiceRole.entities.ScheduleEntry.filter({ client_id: clientId });

    if (!entries.length) {
      return Response.json({ updated: 0 });
    }

    // Build a map of branch names for quick lookup
    const branches = (client.branches || []).filter(b => b.active !== false);

    let updatedCount = 0;

    for (const entry of entries) {
      const currentName = entry.client_name || "";
      
      // Determine what the correct client_name should be
      // Format is "CompanyName" or "CompanyName - BranchName"
      const parts = currentName.split(" - ");
      let newName;

      if (parts.length > 1) {
        // Had a branch — try to keep the branch reference
        const oldBranchName = parts.slice(1).join(" - ");
        // Check if that branch still exists (by old name match or just keep it)
        const matchingBranch = branches.find(b => b.name === oldBranchName);
        if (matchingBranch) {
          newName = `${client.company_name} - ${matchingBranch.name}`;
        } else {
          // Branch was removed or renamed — use company name only
          newName = client.company_name;
        }
      } else {
        // No branch — just update company name
        newName = client.company_name;
      }

      if (newName !== currentName) {
        await base44.asServiceRole.entities.ScheduleEntry.update(entry.id, {
          client_name: newName
        });
        updatedCount++;
      }
    }

    console.log(`Synced ${updatedCount} entries for client ${client.company_name}`);
    return Response.json({ updated: updatedCount });
  } catch (error) {
    console.error('syncClientName error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});