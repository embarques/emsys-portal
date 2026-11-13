import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
function load(relative, replacements) {
  const loadedModule = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", output)(name => {
    if (!(name in replacements)) throw new Error(`Unexpected dependency: ${name}`);
    return replacements[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test("assignment business clock scopes cached state, honors server midnight, and fails closed", () => {
  let auth = { companyId: "company-1", user: {uid: "actor-1"}, roleId: 1, permissions: [], isAuthenticated: true, permissionsLoading: false };
  let options;
  let state = {data: {businessDate: "2026-11-11", serverTime: "2026-11-12T04:59:30Z", nextMidnight: "2026-11-12T05:00:00Z"}, dataUpdatedAt: Date.now(), isError: false, isFetching: false};
  const hooks = load("src/lib/pickup-delivery-routes/hooks/use-assignment-today.ts", {
    "@/lib/auth/hooks/use-auth": {useAuth: () => auth},
    "@/lib/auth/permissions": {permissionKey: p => p.name},
    "@/lib/query/use-workspace-query": {useWorkspaceQuery: input => {options = input; return state;}},
    "@/lib/query/query-keys": {queryKeys: {routeBusinessDate: {detail: scope => ["route-business-date", scope]}}},
    "@/lib/pickup-delivery-routes/api/route-business-date-api": {fetchRouteBusinessDate: () => {}, routeBusinessDateLifetime: clock => Date.parse(clock.nextMidnight) - Date.parse(clock.serverTime)},
  });
  assert.equal(hooks.useAssignmentToday(true, 2), "2026-11-11", "Uses API day even though UTC day is November 12");
  assert.equal(options.enabled, true);
  assert.ok(options.refetchInterval({state}) > 25_000 && options.refetchInterval({state}) <= 30_000);
  const key = options.queryKey;
  hooks.useAssignmentToday(true, 1);
  assert.notDeepEqual(options.queryKey, key);
  auth = {...auth, companyId: "company-2"};
  hooks.useAssignmentToday(true, 2);
  assert.notDeepEqual(options.queryKey, key);
  auth = {...auth, permissions: [{name: "canViewAssignedAppointments"}]};
  hooks.useAssignmentToday(true, 2);
  assert.deepEqual(options.queryKey[1].permissions, ["canViewAssignedAppointments"]);
  state = {...state, dataUpdatedAt: Date.now() - 31_000, isFetching: true};
  assert.equal(hooks.useAssignmentToday(true), "", "Expired day is hidden until refreshed");
  state = {...state, dataUpdatedAt: Date.now(), isError: true};
  assert.equal(hooks.useAssignmentToday(true), "", "Does not fall back to browser date on error");
  assert.equal(hooks.useAssignmentToday(false), "");
  assert.equal(options.enabled, false);
  auth = {...auth, isAuthenticated: false};
  hooks.useAssignmentToday(true);
  assert.equal(options.enabled, false);
});

test("route pickers isolate company, actor and effective grants; rollover changes server filters", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let today = "2026-11-10";
  let auth = { companyId: "company-1", user: { uid: "operator-1" }, roleId: 1, permissions: [{ name: "canViewRoute", resourceType: "route" }], isAuthenticated: true, permissionsLoading: false };
  const requests = [];
  const keys = { list: params => ["daily-routes", "list", params] };
  const hooks = load("src/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes.ts", {
    react: { useMemo: callback => callback(), useCallback: callback => callback },
    "@tanstack/react-query": {},
    "@/lib/auth/hooks/use-auth": { useAuth: () => auth },
    "@/lib/auth/permissions": { permissionKey: p => `${p.resourceType}:${p.name}` },
    "@/lib/pickup-delivery-routes/hooks/use-assignment-today": { useAssignmentToday: () => today },
    "@/lib/pickup-delivery-routes/api/route-business-date-api": {},
    "@/lib/query/use-workspace-query": { useWorkspaceQuery: options => options },
    "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api": { fetchActiveRoutes: async params => { requests.push(params); return { items: [], total: 0 }; } },
    "@/lib/pickup-delivery-routes/types": { DEFAULT_ACTIVE_ROUTE_LIST_PARAMS: { page: 1, limit: 50, sort: "date:desc" } },
    "@/lib/api/search-query": {},
    "@/lib/query/query-keys": { queryKeys: { dailyRouteSchedules: keys }, getScheduledRouteQueryKeys: () => keys },
    "@/lib/pickup-delivery-routes/filter-fields": {},
  });
  for (const picker of [() => hooks.useDailyRoutePicker(50, { assignable: true, branchCode: "NY" }), () => hooks.useActiveRoutePicker("pickup", 50, { assignable: true })]) {
    const first = picker();
    await client.fetchQuery(first);
    const requestCount = requests.length;
    await client.fetchQuery(picker());
    assert.equal(requests.length, requestCount, "Unchanged render reuses the cached route list");
    assert.equal(requests.at(-1).minDate, today);
    assert.equal("companyId" in requests.at(-1), false, "Scope stays out of API filter payloads");
    today = "2026-11-11";
    const nextDay = picker();
    assert.notDeepEqual(first.queryKey, nextDay.queryKey);
    await client.fetchQuery(nextDay);
    assert.equal(requests.length, requestCount + 1, "Midnight requires one new filtered list request");
    auth = { ...auth, companyId: "company-2" };
    const otherCompany = picker();
    assert.notDeepEqual(nextDay.queryKey, otherCompany.queryKey);
    assert.equal(client.getQueryData(otherCompany.queryKey), undefined, "Other company cannot reuse populated cache");
    auth = { ...auth, user: { uid: "operator-2" } };
    const otherActor = picker();
    assert.notDeepEqual(otherCompany.queryKey, otherActor.queryKey);
    auth = { ...auth, permissions: [{ name: "canViewAssignedAppointments", resourceType: "pickup" }] };
    assert.notDeepEqual(otherActor.queryKey, picker().queryKey);
    auth = { ...auth, isAuthenticated: false };
    assert.equal(picker().enabled, false);
    assert.equal(client.getQueryData(picker().queryKey), undefined, "Signed-out context cannot reuse signed-in cache");
    auth = { ...auth, isAuthenticated: true, permissionsLoading: true };
    assert.equal(picker().enabled, false);
    auth = { ...auth, permissionsLoading: false, companyId: "company-1", user: { uid: "operator-1" }, permissions: [{ name: "canViewRoute", resourceType: "route" }] };
    today = "2026-11-10";
  }
  assert.equal(hooks.useDailyRoutePicker(50, { enabled: false }).enabled, false);
  today = "";
  assert.equal(hooks.useDailyRoutePicker(50, { assignable: true }).enabled, false);
  client.clear();
});

test("route-date guard uses the server calendar, passes branch/cancellation, and expires at server midnight", async () => {
  const {z} = await import("zod");
  let clock = {businessDate: "2026-11-11", timezone: "America/New_York", serverTime: "2026-11-12T04:59:59Z", nextMidnight: "2026-11-12T05:00:00Z"};
  let failure;
  const calls = [];
  const api = load("src/lib/pickup-delivery-routes/api/route-business-date-api.ts", {
    zod: {z},
    "@/lib/i18n/translate-current": {translateCurrent: () => "The route business date changed"},
    "@/lib/api/client": {apiClient: {get: async (...args) => {calls.push(args); if(failure) throw failure; return {data: clock};}}},
    "@/lib/api/endpoints": {API_ENDPOINTS: {VEHICLE_ROUTE_BUSINESS_DATE: "/vehicle-routes/business-date"}},
    "@/lib/pickup-delivery-routes/assignment-policy": {assertAssignableRouteDate: (date, today) => {if(date < today) throw new Error("past route");}},
  });
  const signal = new AbortController().signal;
  await api.fetchRouteBusinessDate(2, signal);
  assert.deepEqual(calls[0], ["/vehicle-routes/business-date", {params: {branchId: 2}, signal}]);
  const previous = globalThis.performance;
  let elapsed = 0;
  globalThis.performance = {now: () => elapsed};
  try {
    const guard = await api.fetchRouteDateGuard(2);
    guard("2026-11-11");
    assert.throws(() => guard("2026-11-10"), /past route/);
    elapsed = 1000;
    assert.throws(() => guard("2026-11-11"), /business date changed/);
    assert.equal(calls.length, 2, "Guard rechecks do not add N+1 requests");
  } finally {globalThis.performance = previous;}
  clock = {...clock, nextMidnight: clock.serverTime};
  await assert.rejects(api.fetchRouteDateGuard(), /Expired route business date/);
  failure = new Error("HTTP 403");
  await assert.rejects(api.fetchRouteDateGuard(), /HTTP 403/);
});
