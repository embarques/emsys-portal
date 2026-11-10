#!/usr/bin/env node
/** Appointment/route fixtures only; optional completion probes, no identity or financial changes. */
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
const suite = createApiSuite({
  title: "Daily-route unfinished appointment batch checks",
  options: { writeProbes: { flag: "--write-probes" }, completedProbes: { flag: "--completed-probes" } },
  usage: "  --write-probes    Create/delete two routes and three unfinished appointment fixtures\n  --completed-probes  Also test completion on isolated appointment fixtures (no finances/signatures)\n",
});
const { ok, pass, fail, note, rowsOf } = suite;
const writes = suite.opts.writeProbes && !suite.opts.skipCrud;
suite.opts.skipCrud = !writes;
suite.banner();
const prefix = `CODEX-MIXED-${randomUUID()}`;
const cleanup = [];
const customerCleanup = new Set();
async function request(method, path, body, extraHeaders = {}) {
  const r = await fetch(suite.opts.baseUrl + path, {
    method, headers: { authorization: `Bearer ${suite.opts.token.replace(/^Bearer\s+/i, "")}`,
      "x-company-id": suite.opts.companyId, "content-type": "application/json", ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
  });
  return { status: r.status, json: await r.json() };
}
function verify(label, condition, response) {
  if (condition) pass(label, response ? `HTTP ${response.status}` : "");
  else fail(label, response?.status ?? 0, String(response?.json?.error ?? response?.json?.message ?? "Persisted invariant failed"));
  return condition;
}
function required(label, response) {
  if (!verify(label, ok(response), response)) throw new Error(label);
  return response.json.data;
}
async function read(path) { return required(`Read ${path}`, await request("GET", path)); }
async function create(path, body) {
  const r = await request("POST", path, body);
  if (r.json?.data?.id != null) cleanup.push(`${path}/${r.json.data.id}`);
  const data = required(`Create ${path}`, r);
  if (data?.id == null) throw new Error(`Creation returned no ID; fixture prefix ${prefix}`);
  return data;
}
const state = row => JSON.stringify({ route: row.route ?? null, orderNumber: row.orderNumber ?? 0, completed: row.completed ?? false, dailyRoute: row.dailyRoute ?? null });
const ref = route => ({ id: route.id, name: route.name });
function day(offset) { const date = new Date(); date.setUTCDate(date.getUTCDate() + 760 + offset); return date.toISOString().slice(0, 10); }
try {
  const routeList = await request("POST", "/vehicle-routes/search?page=1&limit=20&offset=0", { sort: [{ field: "date", direction: "desc" }] });
  required("Bounded fixture configuration", routeList);
  if (!writes) note("Read-only run; no fixtures created.");
  else {
    const sample = rowsOf(routeList).find(r => r.routeType === "pickup" && r.branch?.id && r.vehicle?.id && r.driver?.id && r.supervisor?.id);
    if (!sample) throw new Error("No valid pickup configuration in bounded sample; no writes performed");
    const base = { active: true, routeType: "pickup", branch: sample.branch, vehicle: sample.vehicle,
      driver: sample.driver, supervisor: sample.supervisor, helpers: sample.helpers ?? [], employees: sample.employees };
    const first = await create("/vehicle-routes", { ...base, date: `${day(0)}T00:00:00Z` });
    const second = await create("/vehicle-routes", { ...base, date: `${day(1)}T00:00:00Z` });
    const body = { date: day(0), branch: sample.branch, receivers: [], purpose: prefix,
      sender: { name: prefix, customerType: 1, address: { address1: "1 Fixture St", city: "Bronx", state: "NY", zipcode: "10451" } },
      comments: [{ purpose: "PICKUP", unit: "box", quantity: 1, description: prefix }] };
    async function pickup(extra) {
      const created = await create("/pickups", { ...body, ...extra });
      const record = await read(`/pickups/${created.id}`);
      if (record.sender?.id && record.sender.name === prefix) customerCleanup.add(record.sender.id);
      return record;
    }
    const eligible = await pickup({});
    const unselected = await pickup({});
    const branches = rowsOf(await request("GET", "/branches?page=1&limit=20"));
    const otherBranch = branches.find(b => b.id !== sample.branch.id);
    const wrongBranch = otherBranch ? await pickup({ branch: { id: otherBranch.id, code: otherBranch.code, name: otherBranch.name } }) : null;
    required("Assign fixture source membership explicitly", await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [eligible.id, unselected.id] }));
    for (const piece of [eligible, unselected]) {
      if (!verify("Verify initial source membership", (await read(`/pickups/${piece.id}`)).route?.id === first.id)) throw new Error("Invalid fixture source membership");
    }
    required("Seed fixture sequence", await request("PUT", `/pickups/${eligible.id}`, { orderNumber: 8 }));
    let completed;
    if (suite.opts.completedProbes) {
      completed = await pickup({});
      required("Assign completion fixture", await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [completed.id] }));
      required("Complete only fixture appointment", await request("PUT", `/pickups/${completed.id}`, { completed: true }));
      if (!(await read(`/pickups/${completed.id}`)).completed) throw new Error("Completion fixture did not complete");
    }
    const missing = 4294967295;
    if ((await request("GET", `/pickups/${missing}`)).status !== 404) throw new Error("Missing-ID sentinel is not absent");
    for (const [label, ids] of [["empty", []], ["missing", [eligible.id, missing]], ["zero ID", [eligible.id, 0]], ["negative ID", [eligible.id, -1]], ...(wrongBranch ? [["other branch", [eligible.id, wrongBranch.id]]] : []), ...(completed ? [["completed", [eligible.id, completed.id]]] : [])]) {
      const before = state(await read(`/pickups/${eligible.id}`));
      const ineligible = [wrongBranch, completed].filter(p => p && ids.includes(p.id));
      const protectedStates = new Map();
      for (const p of ineligible) protectedStates.set(p.id, state(await read(`/pickups/${p.id}`)));
      const response = await request("PUT", `/pickups/route/${second.id}`, { pickupIds: ids });
      const after = state(await read(`/pickups/${eligible.id}`));
      verify(`Mixed ${label} batch rejects without altering eligible member`, [400, 403, 404, 409].includes(response.status) && before === after, response);
      for (const [id, saved] of protectedStates) verify(`Mixed ${label} batch preserves ineligible fixture`, state(await read(`/pickups/${id}`)) === saved, response);
      if (before !== after) required("Restore only eligible fixture after unexpected batch behavior", await request("PUT", `/pickups/${eligible.id}`, { ...body, route: ref(first), orderNumber: 8 }));
    }
    const duplicate = await request("PUT", `/pickups/route/${second.id}`, { pickupIds: [eligible.id, eligible.id] });
    const afterDuplicate = await read(`/pickups/${eligible.id}`);
    verify("Duplicate IDs assign once or reject unchanged", ok(duplicate) ? afterDuplicate.route?.id === second.id && !afterDuplicate.orderNumber : [400, 409].includes(duplicate.status) && afterDuplicate.route?.id === first.id, duplicate);
    verify("Unselected source member is preserved", (await read(`/pickups/${unselected.id}`)).route?.id === first.id);
    const omitted = await request("PUT", `/pickups/${eligible.id}`, { ...body, purpose: `${prefix}-omit` });
    verify("Omitted route preserves assignment", ok(omitted) && (await read(`/pickups/${eligible.id}`)).route?.id === afterDuplicate.route?.id, omitted);
    if (suite.opts.completedProbes) {
      for (let index = 0; index < 3; index++) {
        const candidate = await pickup({});
        required("Assign race fixture source", await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [candidate.id] }));
        const snapshot = await request("GET", `/pickups/sync/${candidate.id}`);
        const revision = required("Read completion revision", snapshot)?.revision;
        if (!revision) throw new Error("Missing completion revision");
        const [completion, movement] = await Promise.all([
          request("POST", `/pickups/sync/${candidate.id}/complete`, { requestId: randomUUID(), revision }),
          request("PUT", `/pickups/route/${second.id}`, { pickupIds: [candidate.id] }),
        ]);
        const final = await read(`/pickups/${candidate.id}`);
        note(`Pickup completion race ${index + 1}: completion=${completion.status}, assignment=${movement.status}, completed=${!!final.completed}, legacy=${final.legacySyncStatus ?? "absent"}`);
        if (ok(completion)) {
          verify("Successful completion remains completed", final.completed === true, completion);
          const late = await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [candidate.id] });
          verify("Completed fixture rejects later movement", [400, 403, 409].includes(late.status) && state(await read(`/pickups/${candidate.id}`)) === state(final), late);
        } else {
          verify("Rejected completion preserves unfinished fixture", [400, 403, 409].includes(completion.status) && !final.completed, completion);
          note(`Completion response: ${String(completion.json?.error ?? completion.json?.message).slice(0, 180)}`);
        }
      }
    }
    if (suite.opts.completedProbes) {
      const staleCandidate = await pickup({});
      required("Assign stale-revision fixture source", await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [staleCandidate.id] }));
      const original = required("Capture pre-move completion revision", await request("GET", `/pickups/sync/${staleCandidate.id}`));
      required("Commit assignment before completion", await request("PUT", `/pickups/route/${second.id}`, { pickupIds: [staleCandidate.id] }));
      const movedState = state(await read(`/pickups/${staleCandidate.id}`));
      const staleCompletion = await request("POST", `/pickups/sync/${staleCandidate.id}/complete`, { requestId: randomUUID(), revision: original.revision });
      verify("Assignment-first rejects stale completion without overwriting movement", staleCompletion.status === 409 && state(await read(`/pickups/${staleCandidate.id}`)) === movedState, staleCompletion);

      for (const sameRequest of [true, false]) {
        const candidate = await pickup({});
        required("Assign concurrent-completion fixture", await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [candidate.id] }));
        const snapshot = required("Capture concurrent-completion revision", await request("GET", `/pickups/sync/${candidate.id}`));
        const requestId = randomUUID();
        const responses = await Promise.all([
          request("POST", `/pickups/sync/${candidate.id}/complete`, { requestId, revision: snapshot.revision }),
          request("POST", `/pickups/sync/${candidate.id}/complete`, { requestId: sameRequest ? requestId : randomUUID(), revision: snapshot.revision }),
        ]);
        const final = await read(`/pickups/${candidate.id}`);
        note(`Concurrent completion ${sameRequest ? "same UUID" : "distinct UUID"}: ${responses.map(r => r.status).join(",")}`);
        verify(sameRequest ? "Concurrent exact completion replay returns the same committed result" : "Concurrent distinct completion rejects the stale operation", final.completed === true && (sameRequest
          ? responses.every(ok) && JSON.stringify(responses[0].json.data) === JSON.stringify(responses[1].json.data)
          : responses.filter(ok).length === 1 && responses.some(r => r.status === 409)), responses[0]);
      }
    }
    const age = await request("PUT", `/vehicle-routes/${first.id}`, { ...base, date: "2000-01-01T00:00:00Z" });
    required("Age only source fixture route", age);
    const removal = await request("DELETE", `/pickups/${unselected.id}/route`);
    const removed = await read(`/pickups/${unselected.id}`);
    verify("Unfinished old-source removal clears route and order", ok(removal) && !removed.route?.id && !removed.orderNumber && !removed.completed, removal);
    const beforePast = state(await read(`/pickups/${eligible.id}`));
    const past = await request("PUT", `/pickups/route/${first.id}`, { pickupIds: [eligible.id] });
    verify("Past destination rejects and preserves assignment", [400, 409].includes(past.status) && state(await read(`/pickups/${eligible.id}`)) === beforePast, past);
    const nullRemoval = await request("PUT", `/pickups/${eligible.id}`, { ...body, route: null });
    const nullRead = await read(`/pickups/${eligible.id}`);
    verify("Explicit null clears unfinished pickup route and order", ok(nullRemoval) && !nullRead.route?.id && !nullRead.orderNumber, nullRemoval);
  }
} catch (error) { fail("Mixed batch runner", 0, error.message); }
finally {
  for (const path of cleanup.reverse()) {
    try {
      const response = await request("DELETE", path);
      const absent = await request("GET", path);
      verify(`Cleanup ${path}`, ok(response) && absent.status === 404, response);
    } catch (error) { fail(`Cleanup requires attention ${path}`, 0, error.message); }
  }
  for (const id of customerCleanup) {
    try {
      const current = await request("GET", `/customers/${id}`);
      if (current.status === 404) continue;
      if (current.json?.data?.name !== prefix) { fail(`Customer cleanup requires review ${id}`, current.status, "Marker mismatch; not deleted"); continue; }
      const deleted = await request("DELETE", `/customers/${id}`, undefined, { "If-Match": `"${current.json.data.version}"` });
      verify(`Cleanup fixture customer ${id}`, ok(deleted) && (await request("GET", `/customers/${id}`)).status === 404, deleted);
    } catch (error) { fail(`Customer cleanup requires attention ${id}`, 0, error.message); }
  }
}
note(`Fixture marker: ${prefix}. Financial state, signatures and security identities are not part of this suite; --completed-probes only touches fixture appointments.`);
suite.finish(suite.opts.completedProbes ? "Appointment batch, completion and replay matrix complete; scoped actors remain separate." : "Unfinished appointment matrix complete; completion and scoped actors remain separate.");
