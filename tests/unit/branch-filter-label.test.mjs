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
  return load(path.join(root, "src/lib/branches/display.ts"));
}

const { formatBranchFilterLabel } = loadDisplay();

test("does not append the code when the branch name already ends with it", () => {
  assert.equal(
    formatBranchFilterLabel({ id: 1, name: "Embarque Tenares (RD)", code: "RD" }),
    "Embarque Tenares (RD)",
  );
  assert.equal(
    formatBranchFilterLabel({ id: 1, name: "Embarque Tenares (rd)", code: "RD" }),
    "Embarque Tenares (rd)",
  );
});

test("appends the code when the name does not already include it", () => {
  assert.equal(
    formatBranchFilterLabel({ id: 1, name: "Embarque Tenares", code: "NY" }),
    "Embarque Tenares (NY)",
  );
});
