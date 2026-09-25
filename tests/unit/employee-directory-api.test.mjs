import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient) {
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
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const department = { id: 17, name: "Operations", active: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" };

test("department CRUD uses the published routes and name/active payload", async () => {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: method === "get" && args[0].includes("?") ? [department] : department, total: 1 };
  }]));
  const api = loadFeature("src/lib/employee-departments/api/employee-departments-api.ts", client);
  assert.deepEqual((await api.fetchEmployeeDepartments()).items, [department]);
  assert.deepEqual(await api.fetchEmployeeDepartment(17), department);
  assert.deepEqual(await api.createEmployeeDepartment({ name: " Operations ", active: false }), department);
  await api.updateEmployeeDepartment(17, { name: " Operations ", active: false });
  await api.deleteEmployeeDepartment(17);
  assert.deepEqual(calls, [
    ["get", "/employee-departments?page=1&limit=40&sort=name:asc"],
    ["get", "/employee-departments/17"],
    ["post", "/employee-departments", { name: "Operations", active: false }],
    ["put", "/employee-departments/17", { name: "Operations", active: false }],
    ["delete", "/employee-departments/17"],
  ]);
  await assert.rejects(api.createEmployeeDepartment({ name: " ", active: true }));
  await assert.rejects(api.deleteEmployeeDepartment(1.5));
  assert.equal(calls.length, 5);
});

test("department options include later pages and inactive records", async () => {
  let calls = 0;
  const api = loadFeature("src/lib/employee-departments/api/employee-departments-api.ts", {
    get: async () => ({ data: [{ ...department, id: ++calls }], total: 2 }),
  });
  const result = await api.fetchAllEmployeeDepartments();
  assert.deepEqual(result.map((item) => item.id), [1, 2]);
  assert.equal(result[0].active, false);
});

test("department API failures are not reported as successful mutations", async () => {
  const api = loadFeature("src/lib/employee-departments/api/employee-departments-api.ts", {
    delete: async () => ({ success: false, message: "Department is in use" }),
  });
  await assert.rejects(api.deleteEmployeeDepartment(17), /Department is in use/);
});

test("branch update preserves false, zero, empty settings, and cleared fields", async () => {
  const calls = [];
  const api = loadFeature("src/lib/branches/api/branches-api.ts", {
    put: async (url, body) => { calls.push({ url, body }); return { success: true, data: { id: 9, ...body } }; },
  });
  const values = {
    id: 9, name: " Branch ", code: " B ", type: "office", phones: [], logo: "", disclaimer: "",
    address: { address1: "", address2: "", apartment: "", city: "", state: "", zipcode: "", country: "" },
    settings: { defaultLabelStatus: 0, imageResampleBy: 0, invoiceCreatedThruIncomeStatement: false, labelPrefix: "", printLabelCount: false, roundDecimalPlaces: 0, s3BucketFolder: "", s3BucketName: "", s3Profile: "", s3ShareLinkExpireMinutes: 0 },
  };
  await api.updateBranch(9, values);
  assert.equal(calls[0].url, "/branches/9");
  assert.deepEqual(calls[0].body, { ...values, name: "Branch", code: "B" });
  await assert.rejects(api.updateBranch(9, { ...values, settings: { ...values.settings, roundDecimalPlaces: -1 } }));
  assert.equal(calls.length, 1);
});

test("employee create normalizes both dates before reaching the API", async () => {
  const calls = [];
  const client = {
    post: async (url, body) => { calls.push({ url, body }); return { success: true, data: { id: 7, ...body } }; },
    get: async () => ({ data: { id: 7, name: "Employee" } }),
  };
  const api = loadFeature("src/lib/employees/api/employees-api.ts", client);
  const types = loadFeature("src/lib/employees/types.ts", client);
  const values = { ...types.createEmptyEmployeeForm(), name: "Employee", department: "Operations", title: "Driver", phones: [], branch: { id: 9, name: "Branch", code: "B" }, startDate: "2024-02-29", endDate: "2024-03-01T00:30:00+02:00" };
  await api.createEmployee(values);
  assert.equal(calls[0].body.startDate, "2024-02-29T00:00:00.000Z");
  assert.equal(calls[0].body.endDate, "2024-02-29T22:30:00.000Z");
  assert.deepEqual(calls[0].body.branch, { id: 9, code: "B" });
  assert.equal(calls[0].body.department, "Operations");
  // Past endDate forces inactive via resolveEmployeeActiveForEndDate.
  assert.equal(calls[0].body.active, false);
  await assert.rejects(api.createEmployee({ ...values, startDate: "2024-02-30" }));
  assert.equal(calls.length, 1);
  assert.equal(types.areEmployeeFormValuesEquivalent(values, { ...values, startDate: "2024-02-29T00:00:00Z", endDate: "2024-02-29T22:30:00Z" }), true);
});

test("employee create sends active false when the form requests inactive", async () => {
  const calls = [];
  const client = {
    post: async (url, body) => { calls.push({ url, body }); return { success: true, data: { id: 8, ...body } }; },
    get: async () => ({ data: { id: 8, name: "Inactive Employee", active: false } }),
  };
  const api = loadFeature("src/lib/employees/api/employees-api.ts", client);
  const types = loadFeature("src/lib/employees/types.ts", client);
  const values = {
    ...types.createEmptyEmployeeForm(),
    name: "Inactive Employee",
    department: "Operations",
    title: "Driver",
    active: false,
    phones: [],
    branch: { id: 9, name: "Branch", code: "B" },
  };
  assert.equal(types.createEmptyEmployeeForm().active, true);
  await api.createEmployee(values);
  assert.equal(Object.hasOwn(calls[0].body, "active"), true);
  assert.equal(calls[0].body.active, false);
});

test("branch list, detail, create, and delete use the existing endpoints", async () => {
  const calls = [];
  const branch = { id: 9, name: "Branch", code: "B", type: "office", phones: [] };
  const client = Object.fromEntries(["get", "post", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: method === "get" && args[0].includes("?") ? [branch] : branch, total: 1 };
  }]));
  const api = loadFeature("src/lib/branches/api/branches-api.ts", client);
  const types = loadFeature("src/lib/branches/types.ts", client);
  assert.equal((await api.fetchBranches()).items[0].id, 9);
  assert.equal((await api.fetchBranchById(9)).code, "B");
  assert.equal((await api.createBranch({ ...types.createEmptyBranchForm(), ...branch })).id, 9);
  await api.deleteBranch(9);
  assert.match(calls[0][1], /^\/branches\?/);
  assert.equal(calls[1][1], "/branches/9");
  assert.equal(calls[2][0], "post");
  assert.equal(calls[2][1], "/branches");
  assert.deepEqual(calls.at(-1), ["delete", "/branches/9"]);
});

test("employee updates normalize dates and reject invalid input before PUT", async () => {
  const puts = [];
  const client = {
    get: async () => ({ data: { id: 7, name: "Employee" } }),
    put: async (url, body) => { puts.push({ url, body }); return { success: true, data: { id: 7, ...body } }; },
  };
  const api = loadFeature("src/lib/employees/api/employees-api.ts", client);
  const types = loadFeature("src/lib/employees/types.ts", client);
  const values = { ...types.createEmptyEmployeeForm(), name: "Employee", department: "Operations", title: "Driver", phones: [], branch: { id: 9, name: "Branch", code: "B" }, startDate: "2024-02-29T00:00:00-05:00", endDate: "2024-03-01" };
  await api.updateEmployee("7", values);
  assert.equal(puts[0].url, "/employees/7");
  assert.equal(puts[0].body.startDate, "2024-02-29T05:00:00.000Z");
  assert.equal(puts[0].body.endDate, "2024-03-01T00:00:00.000Z");
  await assert.rejects(api.updateEmployee("7", { ...values, endDate: "2023-02-29" }));
  assert.equal(puts.length, 1);
});


const title = { ...department, name: "Driver" };
test("title CRUD uses the published routes and name/active payload", async () => {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: method === "get" && args[0].includes("?") ? [title] : title, total: 1 };
  }]));
  const api = loadFeature("src/lib/employee-titles/api/employee-titles-api.ts", client);
  assert.deepEqual((await api.fetchEmployeeTitles()).items, [title]);
  assert.deepEqual(await api.fetchEmployeeTitle(17), title);
  assert.deepEqual(await api.createEmployeeTitle({ name: " Driver ", active: false }), title);
  await api.updateEmployeeTitle(17, { name: " Driver ", active: false });
  await api.deleteEmployeeTitle(17);
  assert.deepEqual(calls, [
    ["get", "/employee-titles?page=1&limit=40&sort=name:asc"],
    ["get", "/employee-titles/17"],
    ["post", "/employee-titles", { name: "Driver", active: false }],
    ["put", "/employee-titles/17", { name: "Driver", active: false }],
    ["delete", "/employee-titles/17"],
  ]);
  await assert.rejects(api.createEmployeeTitle({ name: " ", active: true }));
  await assert.rejects(api.deleteEmployeeTitle(1.5));
  assert.equal(calls.length, 5);
});

test("title options include later pages and inactive records", async () => {
  let calls = 0;
  const api = loadFeature("src/lib/employee-titles/api/employee-titles-api.ts", {
    get: async () => ({ data: [{ ...title, id: ++calls }], total: 2 }),
  });
  const result = await api.fetchAllEmployeeTitles();
  assert.deepEqual(result.map((item) => item.id), [1, 2]);
  assert.equal(result[0].active, false);
});

test("title API failures are not reported as successful mutations", async () => {
  const api = loadFeature("src/lib/employee-titles/api/employee-titles-api.ts", {
    delete: async () => ({ success: false, message: "Title is in use" }),
  });
  await assert.rejects(api.deleteEmployeeTitle(17), /Title is in use/);
});


test("employee title options preserve the selected legacy or inactive value", () => {
  const { getEmployeeTitleOptions } = loadFeature("src/lib/employee-titles/utils/title-options.ts", {});
  const items = [{ ...title, active: true }, { ...title, id: 18, name: "Former title", active: false }];
  assert.deepEqual(getEmployeeTitleOptions(items, ""), [{ value: "Driver", label: "Driver" }]);
  assert.deepEqual(getEmployeeTitleOptions(items, "Former title"), [
    { value: "Driver", label: "Driver" }, { value: "Former title", label: "Former title" },
  ]);
  assert.deepEqual(getEmployeeTitleOptions(items, "Legacy title").at(-1), { value: "Legacy title", label: "Legacy title" });
  assert.equal(getEmployeeTitleOptions(items, "Driver").length, 1);
});
