import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
function loader(boundaries = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    function localRequire(id) {
      if (id in boundaries) return boundaries[id];
      if (id.startsWith("@/") || id.startsWith(".")) {
        const file = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(filename), id);
        return load(file + ".ts");
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const values = { resourceType: "pickup", resourceId: "record-1", action: "UPDATE", reason: "A correction", text: "Updated", amount: "" };
const target = { resourceType: "pickup", resourceId: "record-1", version: "saved-version", allowedActions: { request_update: true, request_void: false } };
const commands = loader()("src/lib/change-requests/utils/commands.ts");

test("submission requires matching resource, record, version and explicit action permission", () => {
  assert.equal(commands.canRequestChange(target, "pickup", "record-1", "UPDATE"), true);
  for (const context of [undefined, { ...target, resourceType: "invoice" }, { ...target, resourceId: "other" }, { ...target, version: "" }, { ...target, allowedActions: {} }, { ...target, allowedActions: { request_update: "true" } }]) {
    assert.equal(commands.canRequestChange(context, "pickup", "record-1", "UPDATE"), false);
    if (context) assert.throws(() => commands.buildChangeCommand(values, context, "retry-id"));
  }
  assert.equal(commands.canRequestChange(target, "pickup", "record-1", "VOID"), false);
});

test("all five resources produce scoped commands without mutating the original values", () => {
  const changes = { pickup: { purpose: "Updated" }, invoice: { receiver: { name: "Updated" } }, journal: { description: "Updated", amount: 12.5 }, labels: { description: "Updated" }, inventory: { notes: "Updated" } };
  for (const [resourceType, proposedChanges] of Object.entries(changes)) {
    const input = Object.freeze({ ...values, resourceType, amount: "12.50" });
    const command = commands.buildChangeCommand(input, { ...target, resourceType }, "retry-id");
    assert.deepEqual(command.proposedChanges, proposedChanges);
    assert.equal(command.expectedVersion, "saved-version");
    assert.equal(command.requestId, "retry-id");
    assert.equal(command.resourceType, resourceType);
    assert.equal(input.text, "Updated");
  }
});

test("void requests exclude update fields and validation rejects whitespace reasons and invalid amounts", () => {
  const command = commands.buildChangeCommand({ ...values, action: "VOID", text: "", amount: "not-a-number" }, { ...target, allowedActions: { request_void: true } }, "void-id");
  assert.equal("proposedChanges" in command, false);
  for (const invalid of [{ reason: "  " }, { reason: "x".repeat(1001) }, { text: "  " }]) {
    assert.throws(() => commands.buildChangeCommand({ ...values, ...invalid }, target, "id"));
  }
  for (const amount of ["0", "-1", "NaN", "Infinity", "bad"]) {
    assert.throws(() => commands.buildChangeCommand({ ...values, resourceType: "journal", amount }, { ...target, resourceType: "journal" }, "id"));
  }
});

test("API commands use shared endpoints and never send direct resource updates or deletions", async () => {
  const calls = [];
  const record = (method) => async (...args) => { calls.push([method, ...args]); return { data: [], total: 0 }; };
  const load = loader({ "@/lib/api/client": { apiClient: { get: record("GET"), post: record("POST") } } });
  const api = load("src/lib/change-requests/api.ts");
  const controller = new AbortController();
  await api.fetchChangeRequestsPage({ page: 2, limit: 25, sort: "createdAt:desc" }, controller.signal);
  await api.fetchChangeTarget("pickup", "a&b", controller.signal);
  const command = commands.buildChangeCommand(values, target, "retry-id");
  await api.createChange(command);
  await api.reviewChange({ id: "a/b", approve: true, reason: "Approved", resourceType: "pickup" });
  assert.equal(calls[0][1], "/change-requests?page=2&limit=25&offset=25&sort=createdAt%3Adesc");
  assert.equal(calls[1][1], "/change-requests/target?resourceType=pickup&resourceId=a%26b");
  assert.equal(calls[0][2].signal, controller.signal);
  assert.deepEqual(calls[2], ["POST", "/change-requests", command]);
  assert.deepEqual(calls[3], ["POST", "/change-requests/a%2Fb/approve", { reason: "Approved" }]);
});

test("search text and filter rows use POST /change-requests/search with the API's field names", async () => {
  const calls = [];
  const load = loader({ "@/lib/api/client": { apiClient: {
    get: async (...args) => { calls.push(["GET", ...args]); return { data: [], total: 0 }; },
    post: async (...args) => { calls.push(["POST", ...args]); return { data: [], total: 0 }; },
  } } });
  const api = load("src/lib/change-requests/api.ts");
  await api.fetchChangeRequestsPage({
    page: 1, limit: 50, sort: "createdAt:desc", query: "Ana",
    filterRows: [{ id: "r1", field: "status", operator: "eq", value: "PENDING" }],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "POST");
  assert.match(calls[0][1], /^\/change-requests\/search\?/);
  const body = JSON.stringify(calls[0][2]);
  for (const field of ["resourceId", "requestedBy.name", "reviewedBy.name", "status"]) assert.ok(body.includes(`"${field}"`), field);
  assert.ok(body.includes("PENDING"));
});

test("table pages above the API's 100-row cap are read as consecutive capped pages", async () => {
  const urls = [];
  const load = loader({ "@/lib/api/client": { apiClient: {
    get: async (url) => {
      urls.push(url);
      const page = Number(new URL(url, "http://x").searchParams.get("page"));
      return { data: Array.from({ length: page === 1 ? 100 : 20 }, (_, i) => ({ id: `${page}-${i}` })), total: 120 };
    },
  } } });
  const result = await load("src/lib/change-requests/api.ts").fetchChangeRequestsPage({ page: 1, limit: 200, sort: "createdAt:desc" });
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes("limit=100")));
  assert.equal(result.items.length, 120);
  assert.equal(result.total, 120);
});

function hookFixture({ company = "company-a", transportCompany = company, allowed = true } = {}) {
  const invalidations = [];
  const transport = { idToken: "test", companyId: transportCompany };
  const auth = { companyId: company, loading: false, roleLoading: false, user: { uid: "employee-1" }, roleId: 3, permissions: [], hasPermission: () => allowed };
  const load = loader({
    "@tanstack/react-query": { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: async options => invalidations.push(options) }) },
    "@/lib/auth/hooks/use-auth": { useAuth: () => auth },
    "@/lib/store/hooks": { useAppSelector: selector => selector({ auth: transport }) },
    "@/lib/store/store": { store: { getState: () => ({ auth: transport }) } },
    "@/lib/query/use-workspace-query": { useWorkspaceQuery: options => options },
    "@/lib/table/hooks/use-catalog-table": { useCatalogTable: options => options },
    "@/lib/api/client": { apiClient: {} },
  });
  return { hooks: load("src/lib/change-requests/hooks.ts"), auth, invalidations, transport };
}

test("query scopes separate employees and permissions and wait for transport context", () => {
  const { hooks, auth } = hookFixture();
  const first = hooks.useChangeTarget("pickup", "1", true);
  auth.user.uid = "employee-2";
  assert.notDeepEqual(hooks.useChangeTarget("pickup", "1", true).queryKey, first.queryKey);
  assert.equal(hookFixture({ transportCompany: "company-b" }).hooks.useChangeRequestsTable().enabled, false);
  assert.equal(hookFixture({ allowed: false }).hooks.useChangeRequestsTable().enabled, false);
  assert.equal(hooks.useChangeRequestsTable().enabled, true);
  assert.deepEqual(hooks.useChangeRequestsTable().queryKey({ page: 1 }).slice(0, 2), ["change-requests", "company-a"]);
  assert.equal(hooks.useChangeTarget("pickup", "1", false).enabled, false);
});

test("mutation handlers reject missing grants and transport mismatches before HTTP", () => {
  for (const fixture of [hookFixture({ allowed: false }), hookFixture({ transportCompany: "other" })]) {
    assert.throws(() => fixture.hooks.useSubmitChange().mutationFn({}));
    assert.throws(() => fixture.hooks.useReviewChange().mutationFn({}));
  }
  const fixture = hookFixture();
  const submit = fixture.hooks.useSubmitChange();
  const review = fixture.hooks.useReviewChange();
  fixture.transport.companyId = "changed-before-render";
  assert.throws(() => submit.mutationFn({}));
  assert.throws(() => review.mutationFn({}));
});

test("approval refreshes dependent balances including legacy keys; rejection refreshes only requests", async () => {
  const { hooks, invalidations } = hookFixture();
  const review = hooks.useReviewChange();
  await review.onSuccess({}, { approve: true, resourceType: "journal" }, { companyId: "company-a" });
  assert.deepEqual(invalidations.map(value => value.queryKey), [["change-requests", "company-a"], ["accounting"], ["invoices"], ["inventory"]]);
  invalidations.length = 0;
  await review.onSuccess({}, { approve: false, resourceType: "journal" }, { companyId: "company-a" });
  assert.deepEqual(invalidations.map(value => value.queryKey), [["change-requests", "company-a"]]);
  invalidations.length = 0;
  await review.onSuccess({}, { approve: true, resourceType: "journal" }, { companyId: "old-company" });
  assert.deepEqual(invalidations.map(value => value.queryKey), [["change-requests", "old-company"]]);
});
