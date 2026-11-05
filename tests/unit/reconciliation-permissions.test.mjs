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

async function grantsFor(permissions) {
  const apiClient = {get: async () => ({success: true, data: {role: {id: 1, name: "Administrator"}, permissions}})};
  const load = loader(apiClient);
  const {fetchUserPermissions} = load("src/lib/auth/api/permissions-api.ts");
  const {PERMISSIONS, permissionIsGranted, permissionKey} = load("src/lib/auth/permissions.ts");
  const response = await fetchUserPermissions();
  const keys = new Set(response.permissions.map(permissionKey));
  return {PERMISSIONS, granted: (permission) => permissionIsGranted(permission, keys)};
}

test("reconciliation permission names match the backend seed contract", async () => {
  const {PERMISSIONS} = await grantsFor([]);
  assert.deepEqual(PERMISSIONS.journalsReconcile, {name: "canReconcileJournal", resourceType: "journal"});
  assert.deepEqual(PERMISSIONS.inventoryDispatchesReconcile, {name: "canReconcileInventoryDispatch", resourceType: "inventory_dispatch"});
});

test("named reconciliation entries from /users/permissions grant both reconcile actions", async () => {
  const {PERMISSIONS, granted} = await grantsFor([
    {name: "canReconcileJournal", resourceType: "journal"},
    {name: "canReconcileInventoryDispatch", resourceType: "inventory_dispatch"},
  ]);
  assert.equal(granted(PERMISSIONS.journalsReconcile), true);
  assert.equal(granted(PERMISSIONS.inventoryDispatchesReconcile), true);
});

test("CRUD grants on journal and inventory_dispatch do not imply reconciliation", async () => {
  const {PERMISSIONS, granted} = await grantsFor([
    {name: "canViewJournal", resourceType: "journal"},
    {name: "canCreateJournal", resourceType: "journal"},
    {resourceType: "inventory_dispatch", list: true, view: true, create: true, update: true, delete: true},
  ]);
  assert.equal(granted(PERMISSIONS.journalsView), true);
  assert.equal(granted(PERMISSIONS.inventoryDispatchesUpdate), true);
  assert.equal(granted(PERMISSIONS.journalsReconcile), false);
  assert.equal(granted(PERMISSIONS.inventoryDispatchesReconcile), false);
});

test("each reconciliation grant is independent of the other", async () => {
  const {PERMISSIONS, granted} = await grantsFor([{name: "canReconcileJournal", resourceType: "journal"}]);
  assert.equal(granted(PERMISSIONS.journalsReconcile), true);
  assert.equal(granted(PERMISSIONS.inventoryDispatchesReconcile), false);
});

test("journal clearance requires its own grant, without reconciliation or payment update fallbacks", async () => {
  const {PERMISSIONS, granted} = await grantsFor([
    {name: "canReconcileJournal", resourceType: "journal"},
    {name: "canUpdateJournal", resourceType: "journal"},
    {name: "canUpdateCheck", resourceType: "check"},
  ]);
  assert.deepEqual(PERMISSIONS.journalsClear, {name: "canClearJournal", resourceType: "journal"});
  assert.equal(granted(PERMISSIONS.journalsClear), false);
  const clearance = await grantsFor([{name: "canClearJournal", resourceType: "journal"}]);
  assert.equal(clearance.granted(clearance.PERMISSIONS.journalsClear), true);
  assert.equal(clearance.granted(clearance.PERMISSIONS.journalsReconcile), false);
});

test("daily-route operators create/read but request protected changes even with legacy update grants", async () => {
 const {granted}=await grantsFor([
  {name:"canOperateDailyRoute",resourceType:"daily_route_work"},
  {name:"canUpdateJournal",resourceType:"journal"},
  {name:"canReconcileJournal",resourceType:"journal"},
  {name:"canClearJournal",resourceType:"journal"},
  {name:"canCreateChangeRequest",resourceType:"change_request"},
 ]);
 for(const [resource,name] of [["pickup","Pickup"],["invoice","Invoice"],["journal","Journal"],["labels","Labels"],["inventory_dispatch","InventoryDispatch"]]) {
  assert.equal(granted({name:`canCreate${name}`,resourceType:resource}),true);
  assert.equal(granted({name:`canView${name}`,resourceType:resource}),true);
  assert.equal(granted({name:`canUpdate${name}`,resourceType:resource}),false);
  assert.equal(granted({name:`canDelete${name}`,resourceType:resource}),false);
 }
 assert.equal(granted({name:"canReconcileJournal",resourceType:"journal"}),false);
 assert.equal(granted({name:"canClearJournal",resourceType:"journal"}),false);
 assert.equal(granted({name:"canViewChangeRequest",resourceType:"change_request"}),true);
});

test("explicit route-management grant restores normal action permissions", async () => {
 const {PERMISSIONS,granted}=await grantsFor([
  {name:"canOperateDailyRoute",resourceType:"daily_route_work"},
  {name:"canManageDailyRouteRecords",resourceType:"daily_route_work"},
  {name:"canUpdateJournal",resourceType:"journal"},
 ]);
 assert.equal(granted(PERMISSIONS.journalsUpdate),true);
 assert.equal(granted(PERMISSIONS.journalsClear),false);
});
