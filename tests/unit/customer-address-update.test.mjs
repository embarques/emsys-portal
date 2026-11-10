import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const version = `v1:${"a".repeat(64)}`;
const customerId = "650000000000000000000001";
function loadFeature(apiClient) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier === "@/lib/api/axios") return { axiosInstance: {}, normalizeApiError: error => ({ status: error?.status, message: error?.message }) };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return relative => load(path.join(root, relative));
}

function fixture({ rejection } = {}) {
  const calls = [];
  const raw = { id: customerId, version, name: "Existing client", active: true, customerType: 1,
    phones: [{ type: "mobile", number: "2025550198", isPrimary: true }], branch: { id: 1, name: "USA", code: "NY" },
    addresses: [{ address1: "1 Existing St", city: "Bronx", state: "NY", zipcode: "10451", country: "US", isPrimary: true }],
  };
  const load = loadFeature({
    get: async url => {
      calls.push({ method: "GET", url });
      if (url.startsWith("/branches")) return { data: [raw.branch], total: 1 };
      assert.equal(url, `/customers/${customerId}`);
      return { data: structuredClone(raw) };
    },
    put: async (url, body, config) => {
      calls.push({ method: "PUT", url, body: structuredClone(body), config });
      if (rejection) throw rejection;
      Object.assign(raw, body);
      return { success: true };
    },
    post: async () => { throw new Error("An edit must never create a customer"); },
  });
  const api = load("src/lib/customers/api/customers-api.ts");
  const types = load("src/lib/customers/types.ts");
  const originalValues = types.customerToFormValues(api.normalizeApiCustomer(raw));
  return { api, types, originalValues, calls, raw };
}
const editAddress = original => ({ ...structuredClone(original), addresses: original.addresses.map(address => ({ ...address, city: "Brooklyn" })) });

test("address-only edit updates the existing customer without resubmitting unchanged name or phones", async () => {
  const f = fixture();
  const originalSnapshot = structuredClone(f.originalValues);
  const edited = editAddress(f.originalValues);
  const saved = await f.api.updateCustomer(customerId, edited, f.originalValues);
  assert.equal(saved.id, customerId);
  assert.equal(saved.name, f.originalValues.name);
  assert.deepEqual(saved.phones, f.originalValues.phones);
  assert.equal(saved.addresses[0].city, "Brooklyn");
  assert.deepEqual(f.calls.map(c => [c.method, c.url]), [["PUT", `/customers/${customerId}`], ["GET", `/customers/${customerId}`]]);
  const write = f.calls[0];
  assert.deepEqual(Object.keys(write.body).sort(), ["addresses", "id"]);
  assert.deepEqual(write.config, { headers: { "If-Match": `"${version}"` } });
  assert.deepEqual(f.originalValues, originalSnapshot, "Pinned edit snapshot is not mutated");
});

for (const change of ["name", "phones"]) {
  test(`an address edit that also changes ${change} still sends identity changes and propagates duplicate rejection`, async () => {
    const duplicate = Object.assign(new Error("Duplicate name and phone"), { status: 409 });
    const f = fixture({ rejection: duplicate });
    const edited = editAddress(f.originalValues);
    if (change === "name") edited.name = "A different client";
    else edited.phones[0].number = "2025550123";
    await assert.rejects(f.api.updateCustomer(customerId, edited, f.originalValues), error => error === duplicate);
    const write = f.calls.find(c => c.method === "PUT");
    assert.equal(write.url, `/customers/${customerId}`);
    assert.equal(write.body.id, customerId);
    assert.equal(write.body.name, edited.name);
    assert.ok(write.body.phones.length);
    assert.equal(write.body.addresses[0].city, "Brooklyn");
    assert.equal(f.calls.filter(c => c.method === "PUT").length, 1);
    assert.equal(f.calls.filter(c => c.url === `/customers/${customerId}` && c.method === "GET").length, 0, "A duplicate is not converted into a successful save");
  });
}

test("address-only saves keep stale-version rejection and never retry with a newer version", async () => {
  const stale = Object.assign(new Error("STALE_VERSION"), { status: 412 });
  const f = fixture({ rejection: stale });
  await assert.rejects(f.api.updateCustomer(customerId, editAddress(f.originalValues), f.originalValues), error => error === stale);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].config.headers["If-Match"], `"${version}"`);
});

test("missing saved version rejects an address-only save before any request", async () => {
  const f = fixture();
  await assert.rejects(f.api.updateCustomer(customerId, { ...editAddress(f.originalValues), version: undefined }, f.originalValues), /no valid saved version/);
  assert.equal(f.calls.length, 0);
});

test("removing every address sends an explicit empty array", async () => {
  const f = fixture();
  await f.api.updateCustomer(customerId, { ...structuredClone(f.originalValues), addresses: [] }, f.originalValues);
  assert.deepEqual(f.calls[0].body, { id: customerId, addresses: [] });
});

test("unchanged edits remain no-ops and non-address edits are not classified as address-only", () => {
  const f = fixture();
  assert.equal(f.types.areCustomerFormValuesEquivalent(f.originalValues, structuredClone(f.originalValues)), true);
  assert.equal(f.types.isCustomerAddressOnlyEdit(f.originalValues, structuredClone(f.originalValues)), false);
  for (const [key, value] of [["email", "edited@example.invalid"], ["notes", "Changed note"], ["IDNumber", "NEW-ID"]]) {
    const edited = { ...editAddress(f.originalValues), [key]: value };
    assert.equal(f.types.isCustomerAddressOnlyEdit(edited, f.originalValues), false);
  }
});
