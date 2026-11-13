#!/usr/bin/env node
/** Isolated assigned-pickup identity only. Never edits an existing role/user or financial record. */
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import {verifyApprovalMatrix} from "./lib/approval-matrix-fixtures.mjs";
import {verifyReservationPermissions} from "./lib/reservation-permission-fixtures.mjs";
import { createApiSuite } from "./lib/api-suite.mjs";
const suite = createApiSuite({
  title: "Assigned-pickup permission isolation",
  options: { writeProbes: { flag: "--write-probes" }, initialGrants: { flag: "--initial-grants", takesValue: true }, revokeGrant: { flag: "--revoke-grant" }, approvals: {flag: "--approvals"}, output: {flag: "--output", takesValue: true} },
  usage: "  --write-probes    Create/delete one Firebase test user, tenant role/user/employee, two routes and two pickups\n  --initial-grants <view|assigned|update>    Initial temporary role grants (default: view)\n  --revoke-grant    Check removal of assigned update from the temporary role\n",
});
const { ok, note, pass, fail, rowsOf } = suite;
const writes = suite.opts.writeProbes && !suite.opts.skipCrud;
suite.opts.skipCrud = !writes;
suite.banner();
const initialGrants = suite.opts.initialGrants || "view";
if (!["view", "assigned", "update"].includes(initialGrants)) throw new Error("Invalid initial grants");
note(`Initial temporary grants: ${initialGrants}; grant revocation: ${suite.opts.revokeGrant ? "enabled" : "disabled"}`);
const prefix = `CODEX-SCOPE-${randomUUID()}`;
const cleanup = [];
const customers = new Set();
const evidence = [];
let firebaseUser;
let firebaseApp;
let deleteFirebaseUser;
let deleteFirebaseApp;
async function request(method, path, body, token = suite.opts.token, headers = {}) {
  const response = await fetch(suite.opts.baseUrl + path, {
    method, headers: { authorization: `Bearer ${token.replace(/^Bearer\s+/i, "")}`, "x-company-id": suite.opts.companyId,
      "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, json: await response.json() };
}
function verify(label, condition, response) {
  evidence.push({label, passed: Boolean(condition), http: response?.status, message: response?.json?.message});
  if (condition) pass(label, response ? `HTTP ${response.status}` : "");
  else fail(label, response?.status ?? 0, String(response?.json?.error ?? response?.json?.message ?? "Persisted invariant failed"));
  return condition;
}
function requireOk(label, response) {
  if (!verify(label, ok(response), response)) throw new Error(label);
  return response.json.data;
}
async function create(path, body) {
  const response = await request("POST", path, body);
  if (response.json?.data?.id != null) cleanup.push(`${path}/${response.json.data.id}`);
  const data = requireOk(`Create fixture ${path}`, response);
  if (data?.id == null) throw new Error(`No fixture identity returned: ${path}, marker=${prefix}`);
  return data;
}
const read = async path => requireOk(`Read fixture ${path}`, await request("GET", path));
const denied = r => [403, 404].includes(r.status);
const day = offset => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 790 + offset); return `${d.toISOString().slice(0, 10)}T00:00:00Z`; };
try {
  const routeList = await request("POST", "/vehicle-routes/search?page=1&limit=20&offset=0", { sort: [{ field: "date", direction: "desc" }] });
  requireOk("Bounded route prerequisites", routeList);
  if (!writes) note("Read-only run; no security identity or fixture created.");
  else {
    const sample = rowsOf(routeList).find(r => r.routeType === "pickup" && r.branch?.id && r.vehicle?.id && r.driver?.id && r.supervisor?.id);
    if (!sample) throw new Error("No valid pickup configuration");
    const catalog = await request("GET", "/permissions?field=resourceType&operator=eq&value=pickup&page=1&limit=100");
    const view = rowsOf(catalog).find(p => p.name === "canViewAssignedAppointments");
    const update = rowsOf(catalog).find(p => p.name === "canUpdateAssignedAppointments");
    if (!view || !update) throw new Error("Assigned pickup grants missing");
    try { process.loadEnvFile(".env"); } catch { /* Existing environment configuration is also supported. */ }
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw new Error("No Firebase web configuration; no identity created");
    const { initializeApp, deleteApp } = await import("firebase/app");
    const { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } = await import("firebase/auth");
    deleteFirebaseUser = deleteUser; deleteFirebaseApp = deleteApp;
    const initialPermissions = initialGrants === "view" ? [view] : initialGrants === "update" ? [update] : [view, update];
    const role = await create("/roles", { name: prefix, active: true, permissions: initialPermissions });
    firebaseApp = initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, prefix);
    const email = `${prefix.toLowerCase()}@example.invalid`;
    const password = randomBytes(32).toString("base64url");
    const credential = await createUserWithEmailAndPassword(getAuth(firebaseApp), email, password);
    firebaseUser = credential.user;
    const user = await create("/users", { uid: firebaseUser.uid, email: firebaseUser.email, name: prefix, active: true, branch: sample.branch, role: { id: role.id, name: role.name } });
    const employee = await create("/employees", { name: prefix, active: true, branch: sample.branch, user: { id: user.id, name: user.name } });
    const lead = { id: employee.id, name: employee.name };
    const baseRoute = { active: true, routeType: "pickup", branch: sample.branch, vehicle: sample.vehicle,
      driver: sample.driver, supervisor: sample.supervisor, helpers: sample.helpers ?? [], employees: sample.employees };
    const ownedRoute = await create("/vehicle-routes", { ...baseRoute, date: day(0), driver: lead, supervisor: lead,
      helpers: [], employees: [{ ...lead, role: "driver", roles: ["driver", "supervisor"] }] });
    const outsideRoute = await create("/vehicle-routes", { ...baseRoute, date: day(1) });
    const pickupBody = { date: day(0).slice(0, 10), branch: sample.branch, receivers: [], purpose: prefix,
      sender: { name: prefix, customerType: 1, address: { address1: "1 Scoped Fixture St", city: "Bronx", state: "NY", zipcode: "10451" } } };
    const owned = await create("/pickups", pickupBody);
    const outsider = await create("/pickups", pickupBody);
    for (const p of [owned, outsider]) {
      const record = await read(`/pickups/${p.id}`);
      if (record.sender?.id && record.sender.name === prefix) customers.add(record.sender.id);
    }
    requireOk("Assign owned fixture", await request("PUT", `/pickups/route/${ownedRoute.id}`, { pickupIds: [owned.id] }));
    requireOk("Assign outsider fixture", await request("PUT", `/pickups/route/${outsideRoute.id}`, { pickupIds: [outsider.id] }));
    let token = await firebaseUser.getIdToken();
    const initial = await request("GET", "/users/permissions", undefined, token);
    const initialNames = initial.json?.data?.permissions?.map(p => p.name) ?? [];
    if (!verify("Test identity has expected assigned grants and no broad grant", ok(initial) && initialPermissions.every(p => initialNames.includes(p.name)) && !initialNames.includes("canViewPickup") && !initialNames.includes("canUpdatePickup"), initial)) throw new Error("Unexpected fixture grants");
    const businessDate = await request("GET", `/vehicle-routes/business-date?branchId=${sample.branch.id}`, undefined, token);
    verify("Assigned-only actor reads branch business date without financial grants", ok(businessDate) && /^\d{4}-\d{2}-\d{2}$/.test(businessDate.json?.data?.businessDate ?? "") && Boolean(businessDate.json?.data?.timezone) && Date.parse(businessDate.json?.data?.nextMidnight) > Date.parse(businessDate.json?.data?.serverTime), businessDate);
    const ownRead = await request("GET", `/pickups/${owned.id}`, undefined, token);
    verify(initialGrants === "update" ? "Update-only identity cannot read owned fixture" : "Assigned view can read owned fixture", initialGrants === "update" ? denied(ownRead) : ok(ownRead), ownRead);
    const otherRead = await request("GET", `/pickups/${outsider.id}`, undefined, token);
    verify("Assigned view cannot read outsider fixture", denied(otherRead), otherRead);
    const ownWrite = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-view-write` }, token);
    verify(initialGrants === "view" ? "View-only identity cannot update owned fixture" : "Initial assigned update changes owned fixture", initialGrants === "view" ? denied(ownWrite) && (await read(`/pickups/${owned.id}`)).purpose === prefix : ok(ownWrite) && (await read(`/pickups/${owned.id}`)).purpose === `${prefix}-view-write`, ownWrite);
    const initialList = await request("POST", "/pickups/search?page=1&limit=10&offset=0", { operator: "or", filters: [{ field: "id", operator: "eq", value: owned.id }, { field: "id", operator: "eq", value: outsider.id }] }, token);
    verify(initialGrants === "update" ? "Update-only identity cannot list pickups" : "Initial assigned list isolates owned fixture", initialGrants === "update" ? denied(initialList) : ok(initialList) && rowsOf(initialList).length === 1 && rowsOf(initialList)[0].id === owned.id && initialList.json.total === 1, initialList);
    requireOk("Add assigned update only to the temporary role", await request("PUT", `/roles/${role.id}`, { name: prefix, active: true, permissions: [view, update] }));
    // Keep the same authenticated token to verify live grants rather than token refresh.
    const grants = await request("GET", "/users/permissions", undefined, token);
    const granted = grants.json?.data?.permissions?.some(p => p.name === update.name);
    verify("Temporary role update becomes effective", ok(grants) && granted, grants);
    if (granted) {
      const updateOwned = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-assigned-update` }, token);
      verify("Assigned update changes owned fixture", ok(updateOwned) && (await read(`/pickups/${owned.id}`)).purpose === `${prefix}-assigned-update`, updateOwned);
      if (!ok(updateOwned)) {
        const oldToken = token;
        await signOut(getAuth(firebaseApp));
        firebaseUser = (await signInWithEmailAndPassword(getAuth(firebaseApp), email, password)).user;
        token = await firebaseUser.getIdToken();
        note(`Fresh sign-in produced a different token: ${oldToken !== token}`);
        const afterLogin = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-assigned-update` }, token);
        verify("Fresh sign-in applies assigned update grant", ok(afterLogin) && (await read(`/pickups/${owned.id}`)).purpose === `${prefix}-assigned-update`, afterLogin);
      }
      const updateOther = await request("PUT", `/pickups/${outsider.id}`, { purpose: `${prefix}-outsider-update` }, token);
      verify("Assigned update cannot change outsider fixture", denied(updateOther) && (await read(`/pickups/${outsider.id}`)).purpose === prefix, updateOther);
      const remove = await request("DELETE", `/pickups/${owned.id}/route`, undefined, token);
      verify("Assigned-only update cannot clear its route", denied(remove) && (await read(`/pickups/${owned.id}`)).route?.id === ownedRoute.id, remove);
    }
    const list = await request("POST", "/pickups/search?page=1&limit=10&offset=0", { operator: "or", filters: [{ field: "id", operator: "eq", value: owned.id }, { field: "id", operator: "eq", value: outsider.id }] }, token);
    verify("Assigned list excludes outsider before pagination/count", ok(list) && rowsOf(list).length === 1 && rowsOf(list)[0].id === owned.id && list.json.total === 1, list);
    if (suite.opts.revokeGrant) {
      requireOk("Remove assigned update only from the temporary role", await request("PUT", `/roles/${role.id}`, { name: prefix, active: true, permissions: [view] }));
      const removedGrant = await request("GET", "/users/permissions", undefined, token);
      verify("Effective permission list removes assigned update", ok(removedGrant) && !removedGrant.json?.data?.permissions?.some(p => p.name === update.name), removedGrant);
      const beforeRevokeWrite = (await read(`/pickups/${owned.id}`)).purpose;
      const revokedWrite = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-revoked-grant-write` }, token);
      verify("Revoked update grant rejects write without changing fixture", denied(revokedWrite) && (await read(`/pickups/${owned.id}`)).purpose === beforeRevokeWrite, revokedWrite);
      if (ok(revokedWrite)) {
        await signOut(getAuth(firebaseApp));
        firebaseUser = (await signInWithEmailAndPassword(getAuth(firebaseApp), email, password)).user;
        token = await firebaseUser.getIdToken();
        const beforeLoginWrite = (await read(`/pickups/${owned.id}`)).purpose;
        const afterLoginWrite = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-revoked-grant-login` }, token);
        verify("Fresh sign-in enforces revoked update grant", denied(afterLoginWrite) && (await read(`/pickups/${owned.id}`)).purpose === beforeLoginWrite, afterLoginWrite);
      }
    }
    if (suite.opts.approvals) {
      await verifyApprovalMatrix({request, token, role, prefix, view, update, owned, outsider, verify, requireOk, evidence});
      await verifyReservationPermissions({request, token, role, user, prefix, view, update, verify, requireOk, evidence});
    }
    // Isolate crew membership from grant revocation with a positive write control.
    if (suite.opts.revokeGrant) requireOk("Restore fixture update grant before crew control", await request("PUT", `/roles/${role.id}`, { name: prefix, active: true, permissions: [view, update] }));
    const beforeCrewWrite = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-crew-write-control` }, token);
    const beforeCrewPurpose = (await read(`/pickups/${owned.id}`)).purpose;
    const beforeCrewRevocation = await request("GET", `/pickups/${owned.id}`, undefined, token);
    requireOk("Revoke only the fixture crew membership", await request("PUT", `/vehicle-routes/${ownedRoute.id}`, { ...baseRoute, date: day(0) }));
    const revoked = await request("GET", `/pickups/${owned.id}`, undefined, token);
    if (ok(beforeCrewRevocation)) verify("Revoked crew membership removes access", denied(revoked), revoked);
    else note("Crew-revocation read assertion inconclusive: actor lacked an eligible read control before revocation.");
    const revokedCrewWrite = await request("PUT", `/pickups/${owned.id}`, { purpose: `${prefix}-revoked-crew-write` }, token);
    if (ok(beforeCrewWrite)) verify("Revoked crew membership blocks formerly eligible writes", denied(revokedCrewWrite) && (await read(`/pickups/${owned.id}`)).purpose === beforeCrewPurpose, revokedCrewWrite);
    else note("Crew-revocation write assertion inconclusive: actor lacked an eligible write control before revocation.");
  }
} catch (error) { fail("Scoped pickup runner", 0, error.code ?? error.message); }
finally {
  for (const path of cleanup.reverse()) {
    try { const deleted = await request("DELETE", path); verify(`Cleanup ${path}`, ok(deleted) && (await request("GET", path)).status === 404, deleted); }
    catch (error) { fail(`Cleanup requires attention ${path}`, 0, error.message); }
  }
  for (const id of customers) {
    try {
      const record = await request("GET", `/customers/${id}`);
      if (record.status === 404) continue;
      if (record.json?.data?.name !== prefix) { fail(`Customer marker mismatch ${id}`, record.status); continue; }
      const deleted = await request("DELETE", `/customers/${id}`, undefined, suite.opts.token, { "If-Match": `"${record.json.data.version}"` });
      verify(`Cleanup customer ${id}`, ok(deleted) && (await request("GET", `/customers/${id}`)).status === 404, deleted);
    } catch (error) { fail(`Customer cleanup requires attention ${id}`, 0, error.message); }
  }
  if (firebaseUser) {
    try { await deleteFirebaseUser(firebaseUser); pass("Temporary Firebase identity deleted"); }
    catch (error) { fail(`Firebase identity cleanup requires attention ${firebaseUser.uid}`, 0, error.code ?? error.message); }
  }
  if (firebaseApp) await deleteFirebaseApp(firebaseApp);
}
note(`Fixture marker: ${prefix}; no existing user's grants were modified and no credentials are printed.`);
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), marker: prefix, evidence}, null, 2));
suite.finish("Scoped pickup tests complete; financial delivery permissions remain separate.");
