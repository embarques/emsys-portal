import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadDisplay() {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (filename.endsWith(".json")) {
      loadedModule.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      return loadedModule.exports;
    }
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const resolved = [target, `${target}.ts`, path.join(target, "index.ts")].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        return load(resolved);
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, "src/lib/pickup-delivery-routes/display.ts"));
}

function route(overrides) {
  return {
    id: "route-1",
    name: "2-70-26",
    routeType: "pickup",
    container: { id: 70, name: "70-26" },
    date: "2026-10-22",
    dayOfWeek: [],
    branch: { id: 1, code: "NY", name: "New York" },
    vehicle: { id: "v1", name: "Truck 1" },
    active: true,
    route: { id: "crew-1", name: "Basilio crew" },
    employees: [],
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    ...overrides,
  };
}

const {
  formatActiveRouteAssignmentLabel,
  formatActiveRouteReferenceLabel,
  formatActiveRouteRowLabel,
} = loadDisplay();

test("delivery daily routes display the stored conduce name", () => {
  const delivery = route({
    routeType: "delivery",
    branch: { id: 2, code: "RD", name: "RD" },
    name: "2-70-26",
  });
  assert.equal(formatActiveRouteRowLabel(delivery), "2-70-26");
  assert.equal(formatActiveRouteReferenceLabel(delivery), "2-70-26");
  assert.equal(formatActiveRouteAssignmentLabel(delivery), "2-70-26");
});

test("pickup daily routes keep the schedule · crew label, including at RD", () => {
  const pickup = route({
    routeType: "pickup",
    branch: { id: 2, code: "RD", name: "RD" },
    name: "should-not-show",
    container: null,
  });
  const label = formatActiveRouteRowLabel(pickup);
  assert.equal(label.includes("should-not-show"), false);
  assert.equal(label.includes("Basilio crew"), true);
});
