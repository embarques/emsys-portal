import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient } from "@tanstack/react-query";
import axios from "axios";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
function fixture() {
  const cache = new Map();
  let store;
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
      if (id === "@/lib/store/store") return { store };
      if (id === "@/lib/api/api-error") return { logApiErrorDev: () => {}, normalizeApiError: error => error };
      if (id === "@/lib/api/base-url") return { getApiBaseUrl: () => "http://api.test/v1", getConfiguredApiBaseUrl: () => "http://api.test/v1" };
      if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`);
      return require(id);
    };
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const actions = load("src/lib/store/auth/auth-slice.ts");
  store = configureStore({ reducer: { auth: actions.default } });
  const login = (companyId = "company-a", actorId = "actor-a", idToken = "token-a") =>
    store.dispatch(actions.setAuthTransport({ companyId, actorId, idToken }));
  login();
  return { store, login, clear: () => store.dispatch(actions.clearAuthTransport()),
    transport: load("src/lib/api/auth-transport.ts"),
    api: load("src/lib/api/axios.ts").axiosInstance,
    subscribe: load("src/lib/auth/utils/auth-query-boundary.ts").subscribeAuthQueryBoundary };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = config => ({ config, status: 200, statusText: "OK", headers: {}, data: "fixture" });
const unauthorized = (config, status = 401) => new axios.AxiosError("Rejected", "ERR_BAD_REQUEST", config, {}, { ...response(config), status });
const canceled = error => axios.isCancel(error);

test("actor/company/logout transitions change context; ordinary token renewal does not", () => {
  const f = fixture();
  const version = f.store.getState().auth.contextVersion;
  f.login("company-a", "actor-a", "token-refreshed");
  assert.equal(f.store.getState().auth.contextVersion, version);
  f.login("company-a", "actor-b");
  assert.ok(f.store.getState().auth.contextVersion > version);
  f.clear();
  f.login();
  assert.ok(f.store.getState().auth.contextVersion > version + 1, "returning to the same actor/company still starts a new context");
});

test("central headers overwrite stale values and skipCompanyId removes existing tenant headers", async () => {
  const f = fixture();
  let headers;
  const adapter = async config => { headers = config.headers; return response(config); };
  await f.api.get("/invoices", { adapter, headers: { Authorization: "old", "X-Company-ID": "old-company" } });
  assert.equal(headers.get("authorization"), "Bearer token-a");
  assert.equal(headers.get("x-company-id"), "company-a");
  await f.api.get("/filter-presets", { adapter, skipCompanyId: true, headers: { "X-Company-ID": "old-company" } });
  assert.equal(headers.has("x-company-id"), false);
  f.clear();
  await f.api.get("/version", { adapter, headers: { Authorization: "old", "X-Company-ID": "old-company" } });
  assert.equal(headers.has("authorization"), false);
  assert.equal(headers.has("x-company-id"), false);
});

test("changing company during token retrieval cancels before dispatch", async () => {
  const f = fixture(), started = deferred(), token = deferred();
  let sent = 0;
  f.transport.registerIdTokenProvider(() => { started.resolve(); return token.promise; });
  const request = f.api.post("/journals", { amount: 5 }, { adapter: async config => { sent++; return response(config); } });
  await started.promise;
  f.login("company-b", "actor-a", "token-b");
  token.resolve("old-token-a");
  await assert.rejects(request, canceled);
  assert.equal(sent, 0);
  assert.equal(f.store.getState().auth.companyId, "company-b");
});

test("a delayed 401 from an old context never refreshes or replays in the new company", async () => {
  const f = fixture(), started = deferred(), result = deferred();
  let refreshes = 0, config;
  f.transport.registerIdTokenProvider(async force => { if (force) refreshes++; return "token-a"; });
  const request = f.api.get("/invoices", { adapter: input => { config = input; started.resolve(); return result.promise; } });
  await started.promise;
  f.login("company-b", "actor-b", "token-b");
  result.reject(unauthorized(config));
  await assert.rejects(request, canceled);
  assert.equal(refreshes, 0);
});

test("logout during forced refresh cannot restore old transport or dispatch a retry", async () => {
  const f = fixture(), started = deferred(), refreshed = deferred();
  let sent = 0;
  f.transport.registerIdTokenProvider(force => {
    if (!force) return Promise.resolve("token-a");
    started.resolve(); return refreshed.promise;
  });
  const request = f.api.post("/journals", { amount: 5 }, { adapter: async config => { sent++; throw unauthorized(config); } });
  await started.promise;
  f.clear();
  refreshed.resolve("old-refreshed-token");
  await assert.rejects(request, canceled);
  assert.equal(sent, 1);
  assert.equal(f.store.getState().auth.idToken, null);
  assert.equal(await f.transport.resolveIdToken(true), null);
});

test("same-context 401 refresh retries once, preserves payload and retains tenant", async () => {
  const f = fixture();
  const calls = [];
  let refreshes = 0;
  f.transport.registerIdTokenProvider(async force => { if (force) refreshes++; return force ? "fresh" : f.store.getState().auth.idToken; });
  const version = f.store.getState().auth.contextVersion;
  await f.api.post("/journals", { amount: 5 }, { adapter: async config => {
    calls.push({ token: config.headers.get("authorization"), company: config.headers.get("x-company-id"), data: config.data });
    if (calls.length === 1) throw unauthorized(config);
    return response(config);
  } });
  assert.equal(refreshes, 1);
  assert.deepEqual(calls.map(call => call.token), ["Bearer token-a", "Bearer fresh"]);
  assert.deepEqual(calls.map(call => call.company), ["company-a", "company-a"]);
  assert.equal(calls[0].data, calls[1].data);
  assert.equal(f.store.getState().auth.contextVersion, version);
});

test("403 never refreshes and a repeated 401 cannot loop", async () => {
  for (const status of [403, 401]) {
    const f = fixture();
    let refreshes = 0, sent = 0;
    f.transport.registerIdTokenProvider(async force => { if (force) refreshes++; return "token"; });
    await assert.rejects(f.api.get("/invoices", { adapter: async config => { sent++; throw unauthorized(config, status); } }));
    assert.equal(sent, status === 401 ? 2 : 1);
    assert.equal(refreshes, status === 401 ? 1 : 0);
  }
});

test("successful old-context responses are canceled even after returning to the original actor", async () => {
  const f = fixture(), started = deferred(), result = deferred();
  let config;
  const request = f.api.get("/invoices", { adapter: input => { config = input; started.resolve(); return result.promise; } });
  await started.promise;
  f.clear(); f.login();
  result.resolve(response(config));
  await assert.rejects(request, canceled);
});

test("context changes clear business, permission and mutation caches; token renewal preserves them", () => {
  const f = fixture(), client = new QueryClient();
  const stop = f.subscribe(client);
  try {
    client.setQueryData(["customers", "list"], ["company-a-private-data"]);
    client.setQueryData(["permissions", "user"], ["old-grants"]);
    client.getMutationCache().build(client, { mutationFn: async () => "old-result" });
    f.login("company-a", "actor-a", "renewed");
    assert.equal(client.getQueryCache().getAll().length, 2);
    f.login("company-a", "actor-b", "other-user");
    assert.equal(client.getQueryCache().getAll().length, 0);
    assert.equal(client.getMutationCache().getAll().length, 0);
    client.setQueryData(["invoices"], ["company-a-data"]);
    f.login("company-b", "actor-b", "company-b-token");
    assert.equal(client.getQueryCache().getAll().length, 0);
    client.setQueryData(["loans"], ["company-b-data"]);
    f.clear();
    assert.equal(client.getQueryCache().getAll().length, 0);
  } finally { stop(); client.clear(); }
});

test("old pending queries cannot repopulate the cleared cache after a scope change", async () => {
  const f = fixture(), client = new QueryClient(), waiting = deferred(), started = deferred();
  const stop = f.subscribe(client);
  try {
    const request = client.fetchQuery({ queryKey: ["invoices"], queryFn: () => { started.resolve(); return waiting.promise; } });
    const rejected = assert.rejects(request);
    await started.promise;
    f.login("company-b", "actor-a", "b-token");
    client.setQueryData(["invoices"], ["company-b-data"]);
    waiting.resolve(["old-company-a-data"]);
    await rejected;
    assert.deepEqual(client.getQueryData(["invoices"]), ["company-b-data"]);
  } finally { stop(); client.clear(); }
});
