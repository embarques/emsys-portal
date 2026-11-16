#!/usr/bin/env node
/** New NY test identity and two new reservations only; no financial-period changes. */
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
const suite = createApiSuite({ title: "NY device-claim date acceptance", options: {
  writeFixtures: { flag: "--write-fixtures" }, output: { flag: "--output", takesValue: true },
} });
const marker = `CODEX-NY-CLAIM-${randomUUID()}`, evidence = [], owned = [];
let role, user, actorToken, firebaseUser, app, deleteUser, deleteApp, reservations = [], device;
const redact = value => Array.isArray(value) ? value.map(redact) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ["token", "idToken", "refreshToken"].includes(k) ? "[redacted]" : redact(v)])) : value;
async function request(method, path, body, token = suite.opts.token) {
  if (method === "DELETE" && !owned.some(x => path === `${x.path}/${x.id}`)) throw Error("Refusing to delete a pre-existing record");
  const r = await fetch(suite.opts.baseUrl + path, { method, headers: { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "")}`,
    "x-company-id": suite.opts.companyId, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const json = await r.json();
  evidence.push({ method, path, ...(body ? { body: redact(body) } : {}), http: r.status, response: redact(json) });
  return { status: r.status, json };
}
function check(label, condition) {
  evidence.push({ label, passed: Boolean(condition) });
  if (condition) suite.pass(label); else suite.fail(label, 0, "Saved-state assertion failed");
}
function requireOk(r) { if (!suite.ok(r)) throw Error(`HTTP ${r.status}: ${suite.errDetail(r)}`); return r.json.data; }
async function create(path, body) {
  const r = await request("POST", path, body); const id = suite.extractId(r);
  if (suite.ok(r) && id != null) owned.push({ path, id });
  return requireOk(r);
}
async function command(body, token) { return request("POST", "/invoices/reserved/actions", { requestId: randomUUID(), ...body }, token); }
const proof = rows => rows.map(x => ({ id: x.id, token: x.allocation?.token }));
const search = filters => request("POST", "/invoices/reserved/search", { filters, pagination: { page: 1, limit: 5 } });
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) throw Error("Explicit fixture opt-in required");
  try { process.loadEnvFile(".env"); } catch { /* May already be configured. */ }
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw Error("Firebase configuration required before creating fixtures");
  const actor = requireOk(await request("GET", "/users/current"));
  const branch = requireOk(await request("GET", `/branches/${actor.branch.id}`));
  if (branch.code !== "NY") throw Error("Expected existing NY branch");
  const catalog = requireOk(await request("GET", "/permissions?page=1&limit=500"));
  const createInvoice = catalog.find(x => x.name === "canCreateInvoice");
  if (!createInvoice) throw Error("Invoice create grant missing");
  role = await create("/roles", { name: marker, active: true, permissions: [createInvoice] });
  const firebaseApp = await import("firebase/app"), firebaseAuth = await import("firebase/auth");
  deleteApp = firebaseApp.deleteApp; deleteUser = firebaseAuth.deleteUser;
  app = firebaseApp.initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, marker);
  firebaseUser = (await firebaseAuth.createUserWithEmailAndPassword(firebaseAuth.getAuth(app), `${marker.toLowerCase()}@example.invalid`, randomBytes(32).toString("base64url"))).user;
  user = await create("/users", { uid: firebaseUser.uid, email: firebaseUser.email, name: marker, active: true,
    branch, role: { id: role.id, name: role.name } });
  actorToken = await firebaseUser.getIdToken();
  reservations = requireOk(await command({ action: "generate", count: 2, userId: user.id }));
  if (reservations.length !== 2 || reservations.some(x => x.allocation?.userId !== user.id)) throw Error("Owned pool fixture not established");
  const ids = new Set(reservations.map(x => x.id));
  evidence.push({ label: "Generated only new owned NY-user numbers", ids: [...ids], numbers: reservations.map(x => x.number) });
  device = randomUUID();
  const claimBody = { requestId: randomUUID(), action: "claim", count: 2, deviceId: device };
  reservations = requireOk(await command(claimBody, actorToken));
  if (reservations.some(x => !ids.has(x.id))) throw Error("Claim returned an unexpected record; stop");
  check("V14 own device claim returns two owned numbers with receivedAt", reservations.length === 2 && reservations.every(x => x.receivedAt));
  const replay = await command(claimBody, actorToken);
  check("V14 exact device-claim replay retains the owned identities", suite.ok(replay) && replay.json.data.length === 2 && replay.json.data.every(x => ids.has(x.id)));
  const row = suite.rowsOf(await search([{ field: "number", operator: "eq", value: reservations[0].number }]))[0];
  if (!row?.receivedAt) throw Error("Non-null persisted receivedAt control missing");
  check("V14 management search hides claimed tokens and all device IDs", !row.allocation?.token && !row.allocation?.deviceId && !row.deviceId);
  const clock = requireOk(await request("GET", `/vehicle-routes/business-date?branchId=${branch.id}`));
  const day = clock.businessDate;
  for (const [operator, value, expected] of [["eq", day, 1], ["neq", day, 0], ["gte", day, 1], ["lte", day, 1],
    ["gte", new Date(Date.parse(row.receivedAt) + 1000).toISOString(), 0],
    ["lte", new Date(Date.parse(row.receivedAt) - 1000).toISOString(), 0]]) {
    const r = await search([{ field: "number", operator: "eq", value: row.number }, { field: "receivedAt", operator, value }]);
    check(`V14 non-null receivedAt ${operator} ${value} matches expected count`, suite.ok(r) && Number(r.json.total) === expected);
  }
  const wrongDevice = await command({ action: "return", deviceId: randomUUID(), items: proof(reservations) }, actorToken);
  check("V14 another device cannot return the owned claims", wrongDevice.status === 409);
  const beforeReturn = reservations;
  reservations = requireOk(await command({ action: "return", deviceId: device, items: proof(reservations) }, actorToken));
  check("V14 device return clears receipt timestamp", reservations.length === 2 && reservations.every(x => !x.receivedAt));
  const stale = await command({ action: "return", deviceId: device, items: proof(beforeReturn) }, actorToken);
  check("V14 old claimed proof is invalid after return", stale.status === 409);
  for (const original of reservations) {
    const r = await search([{ field: "number", operator: "eq", value: original.number }]);
    check(`V14 ${original.number} persisted receivedAt clears`, suite.ok(r) && suite.rowsOf(r).length === 1 && !suite.rowsOf(r)[0].receivedAt);
  }
} catch (error) {
  evidence.push({ label: "Run stopped", error: error.message }); suite.fail("NY pool-claim prerequisites/acceptance", 0, error.message);
} finally {
  let safelyReturned = reservations.length === 0;
  if (reservations.length && user?.id) {
    try {
      if (reservations.some(x => x.allocation?.deviceId)) reservations = requireOk(await command({ action: "return", deviceId: device, items: proof(reservations) }, actorToken));
      const returned = requireOk(await command({ action: "return", items: proof(reservations) }));
      safelyReturned = returned.every(x => x.allocation?.userId === 0 && !x.receivedAt);
      check("New mock numbers returned to unassigned pool before actor cleanup", safelyReturned);
    } catch (error) { evidence.push({ label: "Fixture reservations need attention; identity retained", error: error.message }); }
  }
  if (safelyReturned) {
    for (const x of [...owned].reverse()) {
      const r = await request("DELETE", `${x.path}/${x.id}`);
      check(`Delete only own temporary ${x.path}/${x.id}`, suite.ok(r));
    }
    if (firebaseUser) try { await deleteUser(firebaseUser); } catch (e) { evidence.push({ label: "Own Firebase cleanup needs attention", error: e.code }); }
  }
  if (app) await deleteApp(app);
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({ checkedAt: new Date().toISOString(), marker,
    companyId: suite.opts.companyId, owned, reservations: reservations.map(x => ({ id: x.id, number: x.number })), evidence,
    limitations: ["Only current-day/instant non-null controls, not actual midnight/DST, other-tenant cursors or concurrent page ties.",
      "No financial periods changed. Pre-existing numbers and identities were not mutated."] }, null, 2) + "\n");
}
suite.finish("Use non-null matching results separately from remaining boundary/cursor work.");
