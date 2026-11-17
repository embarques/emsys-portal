import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function load(relative) {
  const cache = new Map();
  function loadFile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    function localRequire(id) {
      if (id === "react") return require("react");
      if (id.startsWith("@/") || id.startsWith(".")) {
        const file = id.startsWith("@/")
          ? path.join(root, "src", id.slice(2))
          : path.resolve(path.dirname(filename), id);
        if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
        if (fs.existsSync(`${file}.ts`)) return loadFile(`${file}.ts`);
        if (fs.existsSync(`${file}.tsx`)) return loadFile(`${file}.tsx`);
        return loadFile(path.join(file, "index.ts"));
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return loadFile(path.join(root, relative));
}

const {
  resolveAutoDefaultSelectValue,
  shouldAutoDefaultSelect,
} = load("src/components/ui/searchable-select-auto-default.ts");

test("required selects auto-default when only one option exists", () => {
  assert.equal(
    shouldAutoDefaultSelect({ required: true, hasExplicitEmptyOption: false }),
    true,
  );
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      selectableValues: ["only-branch"],
      value: "",
    }),
    "only-branch",
  );
});

test("optional clearable selects do not auto-default", () => {
  assert.equal(
    shouldAutoDefaultSelect({ required: false, clearable: true, hasExplicitEmptyOption: false }),
    false,
  );
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: false,
      selectableValues: ["only"],
      value: "",
    }),
    null,
  );
});

test("non-clearable selects auto-default unless an explicit empty choice exists", () => {
  assert.equal(
    shouldAutoDefaultSelect({ clearable: false, hasExplicitEmptyOption: false }),
    true,
  );
  assert.equal(
    shouldAutoDefaultSelect({ clearable: false, hasExplicitEmptyOption: true }),
    false,
  );
});

test("auto-default skips when there are zero or multiple options", () => {
  assert.equal(
    resolveAutoDefaultSelectValue({ enabled: true, selectableValues: [], value: "" }),
    null,
  );
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      selectableValues: ["a", "b"],
      value: "",
    }),
    null,
  );
});

test("auto-default never overwrites an existing value", () => {
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      selectableValues: ["only"],
      value: "only",
    }),
    null,
  );
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      selectableValues: ["only"],
      value: "stale",
    }),
    null,
  );
});

test("auto-default skips loading and disabled controls", () => {
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      loading: true,
      selectableValues: ["only"],
      value: "",
    }),
    null,
  );
  assert.equal(
    resolveAutoDefaultSelectValue({
      enabled: true,
      disabled: true,
      selectableValues: ["only"],
      value: "",
    }),
    null,
  );
});
