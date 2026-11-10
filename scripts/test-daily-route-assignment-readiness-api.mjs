#!/usr/bin/env node
/** Read-only: no fixture, permission, financial, identity or signature mutations. */
import { createApiSuite } from "./lib/api-suite.mjs";
const suite = createApiSuite({ title: "Daily-route assignment read-only readiness" });
const { request, ok, check, note, pass, fail, rowsOf } = suite;
suite.opts.skipCrud = true;
suite.banner();
const prerequisites = await Promise.allSettled([
  request("GET", "/users/permissions"),
  request("GET", "/branches?page=1&limit=20"),
  request("GET", "/permissions?field=name&operator=contains&value=Assigned&page=1&limit=100"),
  request("POST", "/vehicle-routes/search?page=1&limit=5&offset=0", { sort: [{ field: "date", direction: "desc" }] }),
]);
const labels = ["Effective permissions", "Bounded branches", "Assigned-grant catalog", "Bounded daily routes"];
const results = prerequisites.map((entry, index) => {
  if (entry.status === "fulfilled") { check(labels[index], entry.value); return entry.value; }
  fail(labels[index], 0, String(entry.reason)); return { status: 0, json: null };
});
const permissions = results[0].json?.data?.permissions ?? [];
const broad = ["canViewPickup", "canUpdatePickup", "canViewDelivery", "canUpdateDelivery", "canManageDailyRouteRecords"];
note(`Current broad grants: ${broad.filter(n => permissions.some(p => p.name === n)).join(", ") || "none"}; this actor cannot prove assigned-only denials.`);
const required = ["canViewAssignedAppointments", "canUpdateAssignedAppointments", "canViewAssignedDeliveries", "canUpdateAssignedDeliveries"];
for (const name of required) {
  if (rowsOf(results[2]).some(p => p.name === name)) pass(`Assigned grant exists: ${name}`);
  else fail(`Assigned grant exists: ${name}`, results[2].status, "Absent from bounded assigned-name catalog");
}
for (const branch of rowsOf(results[1]).slice(0, 5)) {
  const context = await request("GET", `/income-statements/context?branchId=${branch.id}`);
  if (!check(`Read-only calendar, branch ${branch.id}`, context)) continue;
  const data = context.json.data;
  const serverTime = new Date(data?.serverTime);
  let formatted;
  try {
    formatted = new Intl.DateTimeFormat("en-CA", { timeZone: data?.serverTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(serverTime);
  } catch { /* An invalid/missing clock contract is reported as a failure below. */ }
  if (data?.serverTimezone && /^\d{4}-\d{2}-\d{2}$/.test(data?.today ?? "") && formatted === data.today) {
    pass(`Server calendar agrees with its timezone, branch ${branch.id}`, `date=${data.today}, timezone=${data.serverTimezone}`);
  } else fail(`Server calendar agrees with its timezone, branch ${branch.id}`, context.status, "Missing/invalid/inconsistent clock metadata");
  const current = await request("GET", `/income-statements/current?branchId=${branch.id}`);
  check(`Read-only current closeout, branch ${branch.id}`, current);
  note(`Branch ${branch.id}: current=${current.json?.data ? "present" : "absent"}, latest date=${String(data?.latest?.businessDate ?? data?.latest?.date ?? "absent").slice(0, 10)}, reason=${data?.requiredReason ?? "absent"}`);
  if (ok(results[3]) && data?.today) {
    const eligible = await request("POST", "/vehicle-routes/search?page=1&limit=5&offset=0", {
      operator: "and", filters: [{ field: "branch.id", operator: "eq", value: branch.id }, { field: "date", operator: "gte", value: `${data.today}T00:00:00Z` }],
      sort: [{ field: "date", direction: "asc" }],
    });
    if (check(`Server date-filtered route lookup, branch ${branch.id}`, eligible)) {
      const unexpected = rowsOf(eligible).some(r => String(r.date).slice(0, 10) < data.today || r.branch?.id !== branch.id);
      if (unexpected) fail(`Route date/branch restriction, branch ${branch.id}`, eligible.status, "Unexpected row in bounded result");
      else pass(`Route date/branch restriction, branch ${branch.id}`, `sample=${rowsOf(eligible).length}; empty results do not prove positive matching`);
    }
  }
}
note("Closeout calendar requires income-statement view permission. It is evidence of that calendar only, not a route-specific clock contract available to assigned-only crews.");
note("No mutation, scoped actor, completion race, midnight clock change or invoice synchronization was exercised by this read-only suite.");
suite.finish("Read-only prerequisites checked; mutation guarantees are explicitly unverified.");
