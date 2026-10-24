import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks);
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", source)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { buildBarcodePrintRequest, barcodeSelectionKey } = load("src/lib/barcodes/print-barcodes.ts");
const rows = [{ id: 1, barcodeId: "abc", number: "duplicate" }, { id: 1, barcodeId: "def", number: "duplicate" }];

test("print and row selection distinguish barcodes with duplicate numbers and numeric sequences", () => {
  assert.notEqual(barcodeSelectionKey(rows[0]), barcodeSelectionKey(rows[1]));
  assert.deepEqual(buildBarcodePrintRequest([...rows, rows[0]]), {
    type: "label", collection: "barcodes", values: ["abc", "def"], lookupField: "id", expiresInHours: 24,
  });
});

test("legacy catalog IDs work; missing IDs reject the entire selection", () => {
  assert.deepEqual(buildBarcodePrintRequest([{ id: 42 }]).values, ["42"]);
  assert.equal(buildBarcodePrintRequest([]), null);
  assert.equal(buildBarcodePrintRequest([...rows, { id: 0, number: "do-not-use-number" }]), null);
});

function setup(mutateAsync, permitted = true) {
  const opened = [], errors = [], successes = [];
  const { usePrintBarcodes: createState } = load("src/lib/barcodes/hooks/use-print-barcodes.ts", {
    react: { useRef: (current) => ({ current }) },
    "@/lib/auth/hooks/use-auth": { useAuth: () => ({ hasPermission: () => permitted }) },
    "@/components/app-shell/feedback-provider": { useFeedback: () => ({ notifyError: (e) => errors.push(e), notifySuccess: (m) => successes.push(m) }) },
    "@/lib/errors": { useUserError: () => ({ toErrorMessage: (e) => e.message }) },
    "@/lib/i18n": { useTranslation: () => ({ t: (key) => key }) },
    "@/lib/reports/hooks/use-reports": { useGenerateLabelReport: () => ({ mutateAsync, isPending: false }) },
    "@/lib/reports/open-report": { openReportUrl: (url) => opened.push(url) },
  });
  return { ...createState(), opened, errors, successes };
}

test("duplicate clicks issue one report request and open its PDF", async () => {
  let resolve, calls = 0;
  const state = setup(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const first = state.printBarcodes(rows);
  await state.printBarcodes(rows);
  assert.equal(calls, 1);
  resolve({ url: "https://example.test/labels.pdf" });
  await first;
  assert.deepEqual(state.opened, ["https://example.test/labels.pdf"]);
  assert.equal(state.successes.length, 1);
});

test("failed reports show errors and allow retry without changing selection", async () => {
  let calls = 0;
  const state = setup(async () => { if (++calls === 1) throw new Error("Report unavailable"); return { url: "retry.pdf" }; });
  await state.printBarcodes(rows);
  assert.deepEqual(state.errors, ["Report unavailable"]);
  assert.deepEqual(state.opened, []);
  await state.printBarcodes(rows);
  assert.deepEqual(state.opened, ["retry.pdf"]);
  assert.equal(rows.length, 2);
});

test("unauthorized and invalid selections never request a report", async () => {
  let calls = 0;
  const mutation = async () => { calls++; return { url: "unexpected.pdf" }; };
  await setup(mutation, false).printBarcodes(rows);
  const state = setup(mutation);
  await state.printBarcodes([{ id: 0 }]);
  assert.equal(calls, 0);
  assert.equal(state.errors.length, 1);
});
