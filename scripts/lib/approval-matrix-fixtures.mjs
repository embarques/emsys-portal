import {randomUUID} from "node:crypto";

/** Only the caller's disposable role and owned pickup are changed. Review records remain audit history. */
export async function verifyApprovalMatrix({request, token, role, prefix, view, update, owned, outsider, verify, requireOk, evidence}) {
  const ok = r => r.status >= 200 && r.status < 300 && r.json?.success !== false;
  async function record(label, method, path, body, actor = token) {
    const r = actor === "admin" ? await request(method, path, body) : await request(method, path, body, actor);
    evidence.push({label, method, path, http: r.status, response: r.json});
    return r;
  }
  const catalog = requireOk("Read approval grant catalog", await record("Approval grants", "GET", "/permissions?page=1&limit=500", undefined, "admin"));
  const named = name => {const grant = catalog.find(p => p.name === name); if (!grant) throw Error(`Missing ${name}`); return grant;};
  const requester = [view, update, ...["canOperateDailyRoute", "canCreateChangeRequest", "canViewChangeRequest"].map(named)];
  const reviewer = [...requester, named("canApproveChangeRequest"), named("canManageDailyRouteRecords")];
  async function grants(permissions) {
    requireOk("Set only temporary approval role grants", await request("PUT", `/roles/${role.id}`, {name: prefix, active: true, permissions}));
  }
  const source = async () => requireOk("Read owned approval source", await request("GET", `/pickups/${owned.id}`));
  const target = async () => requireOk("Read requester target context", await record("Requester target", "GET", `/change-requests/target?resourceType=pickup&resourceId=${owned.id}`));
  const ids = [];
  async function create(text) {
    const context = await target();
    if (!context.allowedActions?.request_update || !context.version) throw Error("Assigned target does not permit request_update");
    const command = {requestId: randomUUID(), resourceType: "pickup", resourceId: String(owned.id), action: "UPDATE", expectedVersion: context.version, reason: prefix, proposedChanges: {purpose: text}};
    const r = await record("Create own UPDATE request", "POST", "/change-requests", command);
    const created = requireOk("Create own protected change request", r);
    ids.push(created.id);
    return {created, command};
  }
  try {
    await grants(requester);
    for (const method of ["GET", "POST"]) {
      const path = method === "GET" ? "/invoices/reserved?limit=1" : "/invoices/reserved/search?page=1&limit=1";
      const body = method === "POST" ? {filters: [{field: "number", operator: "eq", value: prefix}], pagination: {page: 1, limit: 1}} : undefined;
      const denied = await record(`Pool ${method} without view grant`, method, path, body);
      verify(`Pool ${method} denies missing view grant`, denied.status === 403, denied);
      await grants([...requester, named("canViewInvoicePool")]);
      const allowed = await record(`Pool ${method} with view grant`, method, path, body);
      verify(`Pool ${method} accepts explicit view grant with same token`, ok(allowed), allowed);
      await grants(requester);
      const revoked = await record(`Pool ${method} after view grant removal`, method, path, body);
      verify(`Pool ${method} enforces removed view grant with same token`, revoked.status === 403, revoked);
    }
    const before = await source();
    const outside = await record("Other-route approval target denied", "GET", `/change-requests/target?resourceType=pickup&resourceId=${outsider.id}`);
    verify("Requester cannot access another route's target", [403,404].includes(outside.status), outside);
    const {created, command} = await create(`${prefix}-REQUEST-REJECT`);
    verify("Submitting change leaves source unchanged", (await source()).purpose === before.purpose);
    const replay = await record("Create request replay", "POST", "/change-requests", command);
    verify("Identical change creation replays same request ID", ok(replay) && replay.json.data?.id === created.id, replay);
    const forbidden = await record("Reviewer grant missing", "POST", `/change-requests/${created.id}/approve`, {reason: prefix});
    verify("Requester without reviewer grant cannot approve", forbidden.status === 403, forbidden);
    const rejected = await record("Admin rejects own fixture request", "POST", `/change-requests/${created.id}/reject`, {reason: `${prefix} rejection control`}, "admin");
    verify("Authorized rejection succeeds without changing source", ok(rejected) && (await source()).purpose === before.purpose, rejected);
    const next = await create(`${prefix}-SELF-APPROVED`);
    await grants(reviewer);
    const approved = await record("Authorized self-approval", "POST", `/change-requests/${next.created.id}/approve`, {reason: `${prefix} self approval`});
    verify("Explicit authorized reviewer may approve own request", ok(approved) && (await source()).purpose === `${prefix}-SELF-APPROVED`, approved);
    const duplicate = await record("Repeated approval", "POST", `/change-requests/${next.created.id}/approve`, {reason: prefix});
    verify("Repeated review leaves one applied change", (ok(duplicate) || duplicate.status === 409) && (await source()).purpose === `${prefix}-SELF-APPROVED`, duplicate);
    const stale = await create(`${prefix}-STALE-PROPOSED`);
    const locked = await request("PUT", `/pickups/${owned.id}`, {purpose: `${prefix}-CURRENT-SOURCE`});
    verify("Pending request blocks direct source edits even for admin", locked.status === 409 && (await source()).purpose === `${prefix}-SELF-APPROVED`, locked);
    const retired = await record("Reject locked fixture request", "POST", `/change-requests/${stale.created.id}/reject`, {reason: prefix}, "admin");
    requireOk("Reject pending lock control", retired);
    const oldVersion = await record("Stale request submission", "POST", "/change-requests", {...command, requestId: randomUUID(), proposedChanges: {purpose: `${prefix}-STALE-SUBMIT`}});
    verify("Stale captured source version rejects new submission", oldVersion.status === 409 && (await source()).purpose === `${prefix}-SELF-APPROVED`, oldVersion);
    const revoked = await create(`${prefix}-REVOKED`);
    await grants(requester);
    const denied = await record("Same-token reviewer grant removed", "POST", `/change-requests/${revoked.created.id}/approve`, {reason: prefix});
    verify("Same token enforces removed reviewer grant", denied.status === 403 && (await source()).purpose === `${prefix}-SELF-APPROVED`, denied);
    await record("Reject revoked fixture request", "POST", `/change-requests/${revoked.created.id}/reject`, {reason: prefix}, "admin");
  } finally {
    for (const id of ids) {
      const current = await record("Read retained fixture request", "GET", `/change-requests/${id}`, undefined, "admin");
      if (current.json?.data?.status === "PENDING") {
        const rejected = await record("Retire pending fixture request", "POST", `/change-requests/${id}/reject`, {reason: `${prefix} fixture cleanup`}, "admin");
        verify("Remaining fixture request rejected during cleanup", ok(rejected), rejected);
      }
    }
    await grants([view, update]);
    evidence.push({label: "Retained fixture change-request audit IDs", ids});
  }
}
