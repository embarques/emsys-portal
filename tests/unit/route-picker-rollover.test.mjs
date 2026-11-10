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

function clockFixture(instant) {
  const RealDate = globalThis.Date;
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  let current = new RealDate(instant).getTime();
  let next = 0;
  const timers = new Map();
  const listeners = new Map();
  function target(prefix) {
    return {
      addEventListener: (name, callback) => listeners.set(`${prefix}:${name}`, callback),
      removeEventListener: name => listeners.delete(`${prefix}:${name}`),
    };
  }
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [current])); }
  };
  globalThis.window = {
    ...target("window"),
    setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next; },
    clearTimeout: id => timers.delete(id),
  };
  globalThis.document = { ...target("document"), visibilityState: "visible" };
  const clock = load("src/lib/pickup-delivery-routes/hooks/use-assignment-today.ts", {
    react: { useSyncExternalStore: (subscribe, snapshot, serverSnapshot) => ({ subscribe, snapshot, serverSnapshot }) },
    "@/lib/pickup-delivery-routes/assignment-policy": {
      assignmentToday: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
    },
  });
  return {
    clock, timers, listeners,
    advanceTo: value => { current = new RealDate(value).getTime(); },
    restore: () => {
      globalThis.Date = RealDate;
      if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
      if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone;
    },
  };
}

for (const [instant, expectedHours] of [["2026-03-08T00:00:00", 23], ["2026-11-01T00:00:00", 25]]) {
  test(`assignment clock schedules the actual next midnight across ${expectedHours}-hour DST day`, () => {
    const f = clockFixture(instant);
    try {
      const unsubscribe = f.clock.subscribeToAssignmentDay(() => {});
      assert.equal(f.timers.size, 1);
      assert.equal([...f.timers.values()][0].delay, expectedHours * 60 * 60 * 1000);
      unsubscribe();
      assert.equal(f.timers.size, 0);
      assert.equal(f.listeners.size, 0);
    } finally { f.restore(); }
  });
}

test("open assignment UI updates at midnight and recovers from background throttling without polling", () => {
  const f = clockFixture("2026-11-10T23:59:30");
  try {
    const hook = f.clock.useAssignmentToday(true);
    const observed = [];
    const unsubscribe = hook.subscribe(() => observed.push(hook.snapshot()));
    assert.equal(hook.snapshot(), "2026-11-10");
    assert.equal([...f.timers.values()][0].delay, 30_000);
    f.advanceTo("2026-11-11T00:00:00");
    [...f.timers.values()][0].callback();
    assert.deepEqual(observed, ["2026-11-11"]);
    assert.equal(f.timers.size, 1, "Only the next midnight is scheduled");
    f.advanceTo("2026-11-13T09:00:00");
    f.listeners.get("window:focus")();
    assert.equal(observed.at(-1), "2026-11-13");
    f.advanceTo("2026-11-14T09:00:00");
    f.listeners.get("document:visibilitychange")();
    assert.equal(observed.at(-1), "2026-11-14");
    assert.equal(f.timers.size, 1);
    unsubscribe();
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  } finally { f.restore(); }
});

test("closed assignment UI installs no timer or event listener and SSR supplies no guessed day", () => {
  const f = clockFixture("2026-11-10T12:00:00");
  try {
    const hook = f.clock.useAssignmentToday(false);
    const unsubscribe = hook.subscribe(() => {});
    assert.equal(hook.snapshot(), "2026-11-10");
    assert.equal(hook.serverSnapshot(), "");
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    unsubscribe();
  } finally { f.restore(); }
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
