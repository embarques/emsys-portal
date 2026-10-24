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

const row = {
  id: 12,
  barcodeId: "65f000000000000000000001",
  number: "000123",
  description: "Large box",
  invoice: { id: "68f800000000000000000001", number: "INV-77" },
  container: { id: 3, name: "C-3" },
  status: { id: 4, name: "ALM-RD" },
  route: { id: "route-1", name: "Santiago 1" },
  delivery: { id: 5, name: "1-C-3" },
  receiver: {
    name: "Maria Perez",
    address: { address1: "Calle 1 #5", apartment: "2B", city: "Santiago", state: "Santiago", zipcode: "51000" },
    phones: [{ number: "8095550101", displayNumber: "(809) 555-0101", type: "mobile", isPrimary: true }, { number: "" }],
  },
};

function createClient() {
  const calls = [];
  return {
    calls,
    get: async (url, config) => { calls.push({ method: "GET", url, config }); return { success: true, data: [row], total: 1, page: 1 }; },
    post: async (url, body, config) => { calls.push({ method: "POST", url, body, config }); return { success: true, data: [row], total: 1, page: 1 }; },
  };
}

test("unfiltered list requests the assigned-barcodes endpoint sorted by province", async () => {
  const client = createClient();
  const { fetchAssignedDeliveryBarcodesPage } = loadFeature("src/lib/deliveries/api/assigned-deliveries-api.ts", client);
  const { DEFAULT_ASSIGNED_DELIVERY_SORT } = loadFeature("src/lib/deliveries/types.ts", client);
  const controller = new AbortController();
  const result = await fetchAssignedDeliveryBarcodesPage({ page: 1, limit: 25, sort: DEFAULT_ASSIGNED_DELIVERY_SORT }, controller.signal);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].method, "GET");
  assert.match(client.calls[0].url, /^\/deliveries\/assigned-barcodes\?/);
  assert.match(decodeURIComponent(client.calls[0].url), /sort=receiver\.address\.state:asc/);
  assert.equal(client.calls[0].config.signal, controller.signal);
  assert.equal(result.total, 1);
  const [item] = result.items;
  assert.equal(item.number, "000123");
  assert.equal(item.invoiceId, "68f800000000000000000001");
  assert.equal(item.invoiceNumber, "INV-77");
  assert.equal(item.route.id, "route-1");
  assert.deepEqual(item.receiver, {
    name: "Maria Perez", address1: "Calle 1 #5", apartment: "2B", city: "Santiago", province: "Santiago", zipcode: "51000",
    phones: [{ number: "8095550101", displayNumber: "(809) 555-0101", type: "mobile", isPrimary: true }],
  });
});

test("search posts the bar query across barcode, invoice, item, receiver, province, and container", async () => {
  const client = createClient();
  const { fetchAssignedDeliveryBarcodesPage } = loadFeature("src/lib/deliveries/api/assigned-deliveries-api.ts", client);
  await fetchAssignedDeliveryBarcodesPage({ page: 2, limit: 25, sort: "receiver.address.state:asc", query: "santiago" });
  assert.equal(client.calls[0].method, "POST");
  assert.match(client.calls[0].url, /^\/deliveries\/assigned-barcodes\/search\?/);
  const fields = JSON.stringify(client.calls[0].body);
  for (const field of ["number", "invoice.number", "name", "receiver.name", "receiver.address.state", "container.name"]) {
    assert.ok(fields.includes(`"${field}"`), field);
  }
  assert.ok(fields.includes("receiver.address.state"));
});

test("address and phone helpers format the receiver columns", () => {
  const { formatDeliveryAddress, formatDeliveryPhones } = loadFeature("src/lib/deliveries/types.ts", {});
  const receiver = { name: "", address1: "Calle 1 #5", apartment: "2B", city: "", province: "", zipcode: "", phones: [{ number: "8095550101" }, { number: "8095550102", displayNumber: "(809) 555-0102" }] };
  assert.equal(formatDeliveryAddress(receiver), "Calle 1 #5, 2B");
  assert.equal(formatDeliveryAddress({ ...receiver, apartment: "" }), "Calle 1 #5");
  assert.deepEqual(formatDeliveryPhones(receiver), [
    { label: "8095550101", dial: "8095550101" },
    { label: "(809) 555-0102", dial: "8095550102" },
  ]);
  assert.equal(formatDeliveryAddress(null), "");
});

test("invoice balance is read from the row invoice and omitted when absent", () => {
  const { parseAssignedDeliveryBarcodes } = loadFeature("src/lib/deliveries/schemas/assigned-delivery-barcode.schema.ts", {});
  const parse = (invoice) => parseAssignedDeliveryBarcodes([{ ...row, invoice }])[0];
  assert.equal(parse({ ...row.invoice, balance: 125.456 }).invoiceBalance, 125.46);
  assert.equal(parse({ ...row.invoice, balance: "40.5" }).invoiceBalance, 40.5);
  assert.equal(parse({ ...row.invoice, balance: 0 }).invoiceBalance, 0);
  assert.equal(parse({ ...row.invoice, balance: -3 }).invoiceBalance, 0);
  assert.equal("invoiceBalance" in parse(row.invoice), false);
  assert.equal("invoiceBalance" in parse({ ...row.invoice, balance: null }), false);
  assert.equal("invoiceBalance" in parse({ ...row.invoice, balance: "n/a" }), false);
});

test("route exchange rate is read from the row route and omitted when unusable", () => {
  const { parseAssignedDeliveryBarcodes } = loadFeature("src/lib/deliveries/schemas/assigned-delivery-barcode.schema.ts", {});
  const parse = (route) => parseAssignedDeliveryBarcodes([{ ...row, route }])[0];
  assert.equal(parse({ ...row.route, rate: 59.25 }).routeRate, 59.25);
  assert.equal(parse({ ...row.route, rate: "60" }).routeRate, 60);
  assert.equal("routeRate" in parse(row.route), false);
  assert.equal("routeRate" in parse({ ...row.route, rate: 0 }), false);
  assert.equal("routeRate" in parse({ ...row.route, rate: "n/a" }), false);
  assert.equal("routeRate" in parse(null), false);
});

test("DOP amounts use the route rate and are omitted without a usable rate", () => {
  const { toDopAmount } = loadFeature("src/lib/deliveries/types.ts", {});
  assert.equal(toDopAmount(50, 59.25), 2962.5);
  assert.equal(toDopAmount(10.01, 58.333), 583.91);
  assert.equal(toDopAmount(50, undefined), undefined);
  assert.equal(toDopAmount(50, 0), undefined);
});

test("sender name and phones are read from the row and null when absent", () => {
  const { parseAssignedDeliveryBarcodes } = loadFeature("src/lib/deliveries/schemas/assigned-delivery-barcode.schema.ts", {});
  const sender = { name: " Juan Gomez ", address: { address1: "1 Main St" }, phones: [{ number: "7185550100", displayNumber: "(718) 555-0100" }, { number: "" }] };
  assert.deepEqual(parseAssignedDeliveryBarcodes([{ ...row, sender }])[0].sender, {
    name: "Juan Gomez",
    phones: [{ number: "7185550100", displayNumber: "(718) 555-0100" }],
  });
  assert.equal(parseAssignedDeliveryBarcodes([row])[0].sender, null);
  assert.equal(parseAssignedDeliveryBarcodes([{ ...row, sender: null }])[0].sender, null);
});

test("rows that are not barcodes are rejected", () => {
  const { parseAssignedDeliveryBarcodes } = loadFeature("src/lib/deliveries/schemas/assigned-delivery-barcode.schema.ts", {});
  assert.throws(() => parseAssignedDeliveryBarcodes([{}]));
  assert.throws(() => parseAssignedDeliveryBarcodes({ data: [] }));
  assert.equal(parseAssignedDeliveryBarcodes([{ ...row, receiver: null }])[0].receiver, null);
});
