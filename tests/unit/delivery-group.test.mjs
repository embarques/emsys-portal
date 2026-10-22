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




const { resolveDeliveryGroup, buildDeliveryStatusPatches } = loadFeature("src/lib/deliveries/utils/delivery-group.ts", {});
const selected = { invoiceId: "invoice-1", barcodeId: "barcode-a", number: "A", route: { id: "route-1", name: "Daily route" } };
const barcode = (id, number, routeId = "route-1") => ({ id: "1", barcodeId: id, number, routeId });
const invoice = { invoiceId: "invoice-1", invoiceNumber: "INV-1", lineItems: [
  { id: "item-a", itemName: "Box", barcodes: [barcode("barcode-a", "A"), barcode("barcode-b", "B")] },
  { id: "item-b", itemName: "Chair", barcodes: [barcode("barcode-c", "C"), barcode("barcode-d", "D", "route-2")] },
  { id: "item-c", itemName: "Table", barcodes: [barcode("barcode-e", "E", "route-2")] },
] };

test("one clicked barcode resolves every item and barcode on that invoice's daily route", () => {
  const group = resolveDeliveryGroup(selected, invoice);
  assert.equal(group.barcodeCount, 3);
  assert.deepEqual(group.items.map(item => item.lineItemId), ["item-a", "item-b"]);
  assert.deepEqual(group.items.flatMap(item => item.barcodes.map(barcode => barcode.number)), ["A", "B", "C"]);
  assert.equal(group.routeId, "route-1");
});

test("clicking another line item produces the same invoice/route delivery group", () => {
  assert.deepEqual(resolveDeliveryGroup({ ...selected, barcodeId: "barcode-c", number: "C" }, invoice), resolveDeliveryGroup(selected, invoice));
});

test("missing route, mismatched invoice, and a reassigned clicked barcode cannot deliver", () => {
  assert.equal(resolveDeliveryGroup({ ...selected, route: null }, invoice), null);
  assert.equal(resolveDeliveryGroup({ ...selected, invoiceId: "invoice-2" }, invoice), null);
  assert.equal(resolveDeliveryGroup({ ...selected, route: { id: "route-2", name: "Other route" } }, invoice), null);
});

test("duplicate barcode documents are deduplicated without collapsing repeated package sequences", () => {
  const duplicate = { ...invoice, lineItems: [...invoice.lineItems, invoice.lineItems[0]] };
  assert.equal(resolveDeliveryGroup(selected, duplicate).barcodeCount, 3);
});

test("legacy barcode numbers can resolve a group without a document ID", () => {
  assert.equal(resolveDeliveryGroup({ ...selected, barcodeId: undefined }, invoice).barcodeCount, 3);
});

test("legacy barcode delivery IDs do not affect the daily-route delivery group", () => {
  const changed = structuredClone(invoice);
  changed.lineItems[0].barcodes[0].deliveryId = "6";
  changed.lineItems[0].barcodes[1].deliveryId = undefined;
  const group = resolveDeliveryGroup(selected, changed);
  assert.equal(group.routeId, "route-1");
  assert.equal(group.barcodeCount, 3);
  assert.equal("deliveryId" in group, false);
});

test("the invoice receiver is offered as a shortcut without affecting the review fingerprint", () => {
  const { deliveryGroupFingerprint } = loadFeature("src/lib/deliveries/utils/delivery-group.ts", {});
  const withReceiver = { ...invoice, receiver: { name: " Maria Perez ", documentId: " 001-0000000-1 " } };
  assert.deepEqual(resolveDeliveryGroup(selected, withReceiver).invoiceReceiver, { name: "Maria Perez", idNumber: "001-0000000-1" });
  assert.deepEqual(resolveDeliveryGroup(selected, { ...invoice, receiver: { name: "—" } }).invoiceReceiver, { name: "", idNumber: "" });
  assert.deepEqual(resolveDeliveryGroup(selected, invoice).invoiceReceiver, { name: "", idNumber: "" });
  assert.equal(deliveryGroupFingerprint(resolveDeliveryGroup(selected, withReceiver)), deliveryGroupFingerprint(resolveDeliveryGroup(selected, invoice)));
});

test("status patches cover only group barcodes that are not already at the chosen status", () => {
  const changed = structuredClone(invoice);
  changed.lineItems[0].barcodes[1].statusId = 7;
  changed.lineItems[1].barcodes[0].statusName = "entregado";
  const patches = buildDeliveryStatusPatches(resolveDeliveryGroup(selected, changed), { id: 7, name: "ENTREGADO" });
  assert.deepEqual(patches, [{ barcodeId: "barcode-a", number: "A", status: { id: 7, name: "ENTREGADO" } }]);
});
