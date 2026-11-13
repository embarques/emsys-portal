import {randomUUID} from "node:crypto";

/** Only two newly generated numbers and the caller's disposable role/user. */
export async function verifyReservationPermissions({request, token, role, user, prefix, view, update, verify, requireOk, evidence}) {
  const ok = r => r.status >= 200 && r.status < 300 && r.json?.success !== false;
  const catalog = requireOk("Read reservation action grants", await request("GET", "/permissions?page=1&limit=500"));
  const grant = name => {const found = catalog.find(p => p.name === name); if (!found) throw Error(`Missing ${name}`); return found;};
  const base = [view, update, grant("canViewInvoicePool")];
  const generate = grant("canGenerateInvoicePool"), assign = grant("canAssignInvoicePool");
  const path = "/invoices/reserved/actions";
  let owned = [];
  async function grants(extra) {
    requireOk("Set temporary pool action grants", await request("PUT", `/roles/${role.id}`, {name: prefix, active: true, permissions: [...base, ...extra]}));
  }
  const safe = row => ({id: row.id, number: row.number, claimed: row.claimed, allocation: {userId: row.allocation?.userId}});
  async function command(label, body, actor = token) {
    const r = await request("POST", path, body, actor ?? undefined);
    evidence.push({label, http: r.status, response: {success: r.json?.success, message: r.json?.message, error: r.json?.error, data: Array.isArray(r.json?.data) ? r.json.data.map(safe) : undefined}});
    return r;
  }
  const items = rows => rows.map(row => ({id: row.id, token: row.allocation?.token}));
  try {
    await grants([]);
    const body = {requestId: randomUUID(), action: "generate", count: 2, userId: 0};
    const denied = await command("Pool generate without create", body);
    verify("Generate denies missing grant", denied.status === 403, denied);
    await grants([generate]);
    const created = await command("Generate two owned fixture reservations", {...body, requestId: randomUUID()});
    owned = Array.isArray(created.json?.data) ? created.json.data : [];
    verify("Explicit generate grant creates exactly two unassigned numbers", ok(created) && owned.length === 2 && owned.every(row => row.allocation?.userId === 0), created);
    if (owned.length !== 2 || owned.some(row => !row.allocation?.token)) throw Error("Generated reservation token controls unavailable");
    const assignment = {requestId: randomUUID(), action: "assign", userId: user.id, items: items(owned)};
    const noAssign = await command("Assign without update grant", assignment);
    verify("Assign denies missing grant", noAssign.status === 403, noAssign);
    await grants([generate, assign]);
    const assigned = await command("Assign only the two generated numbers", {...assignment, requestId: randomUUID()});
    if (ok(assigned)) owned = assigned.json.data;
    verify("Explicit assignment grant assigns both numbers to fixture user", ok(assigned) && owned.every(row => row.allocation?.userId === user.id), assigned);
    await grants([generate]);
    const returned = {requestId: randomUUID(), action: "return", items: items(owned)};
    const noReturn = await command("Return after update grant removal", returned);
    verify("Same token denies return after grant removal", noReturn.status === 403, noReturn);
    await grants([generate, assign]);
    const done = await command("Return only the owned fixture reservations", {...returned, requestId: randomUUID()});
    verify("Restored grant returns both numbers to unassigned pool", ok(done) && done.json?.data?.length === 2 && done.json.data.every(row => row.allocation?.userId === 0), done);
    if (ok(done)) owned = done.json.data;
    const stale = await command("Old assignment tokens after return", {...returned, requestId: randomUUID()});
    verify("Returning invalidates old assignment tokens", stale.status === 409, stale);
    evidence.push({label: "Retained generated unassigned fixture reservations", rows: owned.map(safe)});
  } finally {
    const assigned = owned.filter(row => row.allocation?.userId === user.id);
    if (assigned.length) {
      const cleanup = await command("Administrative return of owned fixture numbers", {requestId: randomUUID(), action: "return", items: items(assigned)}, null);
      verify("No generated number remains allocated to deleted fixture user", ok(cleanup), cleanup);
    }
    requireOk("Restore temporary role after reservation tests", await request("PUT", `/roles/${role.id}`, {name: prefix, active: true, permissions: [view, update]}));
  }
}
