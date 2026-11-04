import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loader(apiClient = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = {exports: {}};
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
    function localRequire(id) {
      if (id === "@/lib/api/client") return {apiClient};
      if (id.startsWith("@/") || id.startsWith(".")) {
        const file = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(filename), id);
        return load(fs.existsSync(file + ".ts") ? file + ".ts" : path.join(file, "index.ts"));
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

async function accessFor(permissions) {
  const apiClient = {get: async () => ({success: true, data: {role: {id: 1, name: "Role"}, permissions}})};
  const load = loader(apiClient);
  const {fetchUserPermissions} = load("src/lib/auth/api/permissions-api.ts");
  const {PERMISSIONS, permissionIsGranted, permissionKey} = load("src/lib/auth/permissions.ts");
  const {resolveInvoiceCreateAccess} = load("src/lib/invoices/utils/invoice-create-access.ts");
  const response = await fetchUserPermissions();
  const keys = new Set(response.permissions.map(permissionKey));
  const granted = (permission) => permissionIsGranted(permission, keys);
  return {PERMISSIONS, granted, access: resolveInvoiceCreateAccess(granted)};
}

test("invoice permission names match the backend seed contract", async () => {
  const {PERMISSIONS} = await accessFor([]);
  assert.deepEqual(PERMISSIONS.invoicesCreate, {name: "canCreateInvoice", resourceType: "invoice"});
  assert.deepEqual(PERMISSIONS.invoicesView, {name: "canViewInvoice", resourceType: "invoice"});
  assert.deepEqual(PERMISSIONS.invoicesUpdate, {name: "canUpdateInvoice", resourceType: "invoice"});
  assert.deepEqual(PERMISSIONS.invoicesDelete, {name: "canDeleteInvoice", resourceType: "invoice"});
  assert.deepEqual(PERMISSIONS.invoicesCreateAssigned, {name: "canCreateAssignedInvoice", resourceType: "invoice"});
});

test("invoice CRUD flags grant create, update and delete independently", async () => {
  const {PERMISSIONS, granted} = await accessFor([{resourceType: "invoice", view: true, update: true}]);
  assert.equal(granted(PERMISSIONS.invoicesView), true);
  assert.equal(granted(PERMISSIONS.invoicesUpdate), true);
  assert.equal(granted(PERMISSIONS.invoicesCreate), false);
  assert.equal(granted(PERMISSIONS.invoicesDelete), false);
});

test("canCreateInvoice opens the full wizard even with the assigned grant", async () => {
  const {access} = await accessFor([
    {name: "canCreateInvoice", resourceType: "invoice"},
    {name: "canCreateAssignedInvoice", resourceType: "invoice"},
  ]);
  assert.deepEqual(access, {canCreate: true, canCreateFromAppointment: true, isAssignedOnly: false, canOpenInvoices: false});
});

test("canCreateAssignedInvoice without canCreateInvoice gets the assigned flow", async () => {
  const {access} = await accessFor([
    {name: "canViewInvoice", resourceType: "invoice"},
    {name: "canCreateAssignedInvoice", resourceType: "invoice"},
  ]);
  assert.deepEqual(access, {canCreate: false, canCreateFromAppointment: true, isAssignedOnly: true, canOpenInvoices: true});
});

test("viewing invoices alone no longer allows creating them", async () => {
  const {access} = await accessFor([{name: "canViewInvoice", resourceType: "invoice"}]);
  assert.equal(access.canCreate, false);
  assert.equal(access.canCreateFromAppointment, false);
  assert.equal(access.isAssignedOnly, false);
});
