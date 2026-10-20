#!/usr/bin/env node
/**
 * Smoke-test the clearable payment APIs behind Checks, Deposits, Zelle and
 * Credit cards.
 *
 * Covers, for each of /checks, /deposits, /zelle-payments, /credit-card-payments:
 *   GET  /<resource>
 *   POST /<resource>/search
 *   POST /<resource>                      (only with --invoice-id)
 *   GET|PUT|DELETE /<resource>/{id}       (only with --invoice-id)
 *
 * Safety: per the API contract, OUTSTANDING payments never change invoice
 * payment/balance — only CLEARED does. The throwaway payments are created and
 * updated as OUTSTANDING (0.01 / 0.02), never cleared, and always deleted. The
 * suite re-reads the invoice afterwards and fails if its payment or balance
 * moved. CRUD is opt-in: pass the id of a disposable test invoice.
 *
 * Usage:
 *   node scripts/test-accounting-payments-api.mjs '<jwt>' [--invoice-id <id>] [--only checks,deposits]
 *
 * Env equivalents: EMSYS_TEST_INVOICE_ID, EMSYS_PAYMENT_SUITES=checks,deposits
 */
import { createApiSuite } from "./lib/api-suite.mjs";
import { createSeeder } from "./lib/seed-records.mjs";

const RESOURCES = [
  { id: "checks", path: "/checks", label: "Checks", checkNumberAlias: true },
  { id: "deposits", path: "/deposits", label: "Deposits" },
  { id: "zelle", path: "/zelle-payments", label: "Zelle" },
  { id: "credit-cards", path: "/credit-card-payments", label: "Credit cards" },
];

const suite = createApiSuite({
  title: "Accounting payments API smoke test (checks, deposits, Zelle, credit cards)",
  usage: `  --invoice-id <id>  Disposable invoice to attach OUTSTANDING throwaway payments to (enables CRUD)
  --only <ids>       Comma-separated subset of: ${RESOURCES.map((r) => r.id).join(", ")}
`,
  options: {
    invoiceId: { flag: "--invoice-id", env: "EMSYS_TEST_INVOICE_ID", takesValue: true },
    only: { flag: "--only", env: "EMSYS_PAYMENT_SUITES", takesValue: true },
  },
});
const { request, check, note, extractId, rowsOf, stamp, ok, pass, fail } = suite;

const only = suite.opts.only ? suite.opts.only.split(",").map((s) => s.trim()).filter(Boolean) : [];
const selected = only.length ? RESOURCES.filter((resource) => only.includes(resource.id)) : RESOURCES;
const crudEnabled = !suite.opts.skipCrud && Boolean(suite.opts.invoiceId);

suite.banner([
  `Invoice:  ${suite.opts.invoiceId || "(none — payment CRUD skipped; pass --invoice-id)"}`,
  `Suites:   ${selected.map((resource) => resource.id).join(", ")}`,
]);

const todayRfc3339 = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

async function readInvoiceTotals(invoiceId) {
  const res = await request("GET", `/invoices/${invoiceId}`);
  const data = res.json?.data;
  if (!ok(res) || !data) return null;
  return { number: String(data.number ?? ""), payment: Number(data.payment ?? 0), balance: Number(data.balance ?? 0) };
}

function outstandingPaymentBody(resource, invoice, reference, amount) {
  return {
    invoice: { id: suite.opts.invoiceId, ...(invoice?.number ? { number: invoice.number } : {}) },
    paymentReference: reference,
    ...(resource.checkNumberAlias ? { checkNumber: reference } : {}),
    paymentAmount: amount,
    datePosted: todayRfc3339,
    status: "OUTSTANDING",
  };
}

async function runResource(resource, invoice) {
  console.log(`\n=== ${resource.label} (${resource.path}) ===`);
  const seeder = createSeeder(suite);
  try {
    const seeds =
      crudEnabled && invoice
        ? await seeder.seed({
            label: `${resource.id} payment`,
            path: resource.path,
            body: (index) =>
              outstandingPaymentBody(resource, invoice, `ZZPROBESEED${resource.id.toUpperCase().replace(/-/g, "")}${stamp}${index}`, 0.01),
            lookup: (body) => [{ field: "paymentReference", operator: "eq", value: body.paymentReference }],
          })
        : [];
    await runResourceChecks(resource, invoice, seeds[0]);
    await seeder.verifyListed();
  } finally {
    await seeder.cleanup();
  }
}

async function runResourceChecks(resource, invoice, seedSample) {
  const list = await suite.listOrExit(`${resource.path}?page=1&limit=20&offset=0&sort=createdAt:desc`);
  const sample = seedSample ?? rowsOf(list)[0];
  if (sample?.id) {
    check(`GET ${resource.path}/${sample.id}`, await request("GET", `${resource.path}/${sample.id}`), (r) => `status=${r.json?.data?.status ?? "?"}`);
  }

  const search = (label, filters) =>
    request("POST", `${resource.path}/search?page=1&limit=5&offset=0`, { filters }).then((res) => check(label, res, suite.summarizeList));
  await search(`POST ${resource.path}/search bar OR`, [
    {
      operator: "or",
      filters: ["paymentReference", "invoice.number", "refNumber", "createdBy.name"].map((field) => ({ field, operator: "contains", value: "1" })),
    },
  ]);
  await search("search status eq OUTSTANDING", [{ field: "status", operator: "eq", value: "OUTSTANDING" }]);
  await search("search paymentAmount gte 0 (number)", [{ field: "paymentAmount", operator: "gte", value: 0 }]);

  if (!crudEnabled || !invoice) return;

  const reference = `ZZPROBE${resource.id.toUpperCase().replace(/-/g, "")}${stamp}`;
  const createBody = outstandingPaymentBody(resource, invoice, reference, 0.01);

  const create = await request("POST", resource.path, createBody);
  let createdId = extractId(create);
  if (ok(create) && createdId == null) {
    const found = await request("POST", `${resource.path}/search?page=1&limit=1&offset=0`, {
      filters: [{ field: "paymentReference", operator: "eq", value: reference }],
    });
    createdId = rowsOf(found)[0]?.id ?? null;
  }
  if (!check(`POST ${resource.path}`, create, `id=${createdId} amount=0.01 OUTSTANDING`) || createdId == null) return;

  try {
    const read = await request("GET", `${resource.path}/${createdId}`);
    const status = String(read.json?.data?.status ?? "").toUpperCase();
    if (ok(read) && status === "OUTSTANDING") pass(`GET ${resource.path}/${createdId} after create`, "status=OUTSTANDING");
    else fail(`GET ${resource.path}/${createdId} after create`, read.status, `expected OUTSTANDING, got "${status}"`);

    const updatedReference = `${reference}U`;
    const update = await request("PUT", `${resource.path}/${createdId}`, {
      ...createBody,
      id: createdId,
      paymentReference: updatedReference,
      ...(resource.checkNumberAlias ? { checkNumber: updatedReference } : {}),
      paymentAmount: 0.02,
    });
    check(`PUT ${resource.path}/${createdId}`, update, "reference + amount, still OUTSTANDING");
    const reread = await request("GET", `${resource.path}/${createdId}`);
    const data = reread.json?.data ?? {};
    if (data.paymentReference === updatedReference && Number(data.paymentAmount) === 0.02) {
      pass("update persisted", "paymentReference + paymentAmount");
    } else {
      fail("update persisted", reread.status, `paymentReference=${data.paymentReference} paymentAmount=${data.paymentAmount}`);
    }
  } finally {
    check(`DELETE ${resource.path}/${createdId}`, await request("DELETE", `${resource.path}/${createdId}`));
    const gone = await request("GET", `${resource.path}/${createdId}`);
    if (gone.status === 404) pass(`GET ${resource.path}/${createdId} after delete`, "404 as expected");
    else fail(`GET ${resource.path}/${createdId} after delete`, gone.status, "expected 404");
  }
}

let invoiceBefore = null;
if (crudEnabled) {
  invoiceBefore = await readInvoiceTotals(suite.opts.invoiceId);
  if (!invoiceBefore) {
    fail(`GET /invoices/${suite.opts.invoiceId}`, 0, "test invoice not found; payment CRUD skipped");
  } else {
    pass(`GET /invoices/${suite.opts.invoiceId}`, `number=${invoiceBefore.number} payment=${invoiceBefore.payment} balance=${invoiceBefore.balance}`);
  }
} else if (!suite.opts.skipCrud) {
  note("Payment CRUD skipped: pass --invoice-id <disposable test invoice> (or EMSYS_TEST_INVOICE_ID) to enable it.");
}

for (const resource of selected) {
  await runResource(resource, invoiceBefore);
}

if (invoiceBefore) {
  console.log("\n=== Invoice totals unchanged ===");
  const after = await readInvoiceTotals(suite.opts.invoiceId);
  if (after && after.payment === invoiceBefore.payment && after.balance === invoiceBefore.balance) {
    pass(`invoice ${invoiceBefore.number || suite.opts.invoiceId} totals`, `payment=${after.payment} balance=${after.balance}`);
  } else {
    fail(
      `invoice ${invoiceBefore.number || suite.opts.invoiceId} totals`,
      0,
      `before payment=${invoiceBefore.payment} balance=${invoiceBefore.balance}; after payment=${after?.payment} balance=${after?.balance}`,
    );
  }
}

suite.finish("All accounting payment checks passed.");
