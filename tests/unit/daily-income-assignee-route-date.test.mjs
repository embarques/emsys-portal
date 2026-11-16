import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const {
  calendarDayBefore,
  isTodayOrYesterdayRouteDate,
} = loadFeature("src/lib/accounting/daily-income/assignee.ts");

test("calendarDayBefore returns the previous YYYY-MM-DD day", () => {
  assert.equal(calendarDayBefore("2026-11-16"), "2026-11-15");
  assert.equal(calendarDayBefore("2026-03-01"), "2026-02-28");
  assert.equal(calendarDayBefore("2024-03-01"), "2024-02-29");
  assert.equal(calendarDayBefore("bad"), null);
});

test("isTodayOrYesterdayRouteDate accepts today and yesterday only", () => {
  assert.equal(isTodayOrYesterdayRouteDate("2026-11-16", "2026-11-16"), true);
  assert.equal(isTodayOrYesterdayRouteDate("2026-11-15", "2026-11-16"), true);
  assert.equal(isTodayOrYesterdayRouteDate("2026-11-15T18:00:00Z", "2026-11-16"), true);
  assert.equal(isTodayOrYesterdayRouteDate("2026-11-14", "2026-11-16"), false);
  assert.equal(isTodayOrYesterdayRouteDate("2026-11-17", "2026-11-16"), false);
  assert.equal(isTodayOrYesterdayRouteDate("", "2026-11-16"), false);
});
