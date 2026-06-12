#!/usr/bin/env node
/**
 * Probe live EMSYS invoice list + detail responses vs backend model.
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=1 node scripts/probe-invoices-api.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_INVOICE_ID=<mongo-id>   # fetch GET /invoices/{id} as well
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = process.env.EMSYS_TOKEN?.trim();
const companyId = process.env.EMSYS_COMPANY_ID?.trim() ?? "1";
const invoiceId = process.env.EMSYS_INVOICE_ID?.trim();

const MODEL_INVOICE_FIELDS = [
  "balance",
  "branch",
  "container",
  "cost",
  "createdAt",
  "date",
  "discount",
  "employee",
  "id",
  "invoiceDetails",
  "isArchive",
  "isVoid",
  "number",
  "oldID",
  "paidRegion",
  "paidStatus",
  "payment",
  "pickup",
  "receiver",
  "registration",
  "sender",
  "surcharge",
  "updatedAt",
  "user",
];

const MODEL_INVOICE_DETAIL_FIELDS = [
  "barcode",
  "barcodes",
  "cost",
  "createdAt",
  "description",
  "id",
  "invoice",
  "labels",
  "name",
  "price",
  "quantity",
  "total",
  "updatedAt",
];

if (!token) {
  console.error("Set EMSYS_TOKEN (Firebase JWT) to run this probe.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: response.status, json };
}

function collectKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).map((key) => (prefix ? `${prefix}.${key}` : key));
}

function diffFields(modelFields, actualKeys) {
  const actual = new Set(actualKeys);
  const present = modelFields.filter((field) => actual.has(field));
  const missing = modelFields.filter((field) => !actual.has(field));
  const extra = actualKeys.filter((key) => !modelFields.includes(key));
  return { present, missing, extra };
}

function printFieldDiff(title, modelFields, sample) {
  const keys = sample && typeof sample === "object" ? Object.keys(sample) : [];
  const { present, missing, extra } = diffFields(modelFields, keys);

  console.log(`\n=== ${title} ===`);
  console.log("keys in response:", keys.length ? keys.join(", ") : "(none)");
  console.log("\nModel fields present:", present.length ? present.join(", ") : "(none)");
  console.log("Model fields missing:", missing.length ? missing.join(", ") : "(none)");
  console.log("Extra fields (not in model list):", extra.length ? extra.join(", ") : "(none)");
}

console.log("=== GET /invoices?page=1&limit=3&offset=0&sort=number:desc ===");
const list = await request("GET", "/invoices?page=1&limit=3&offset=0&sort=number:desc");
console.log("status:", list.status);

if (list.status !== 200) {
  console.log(JSON.stringify(list.json, null, 2));
  process.exit(1);
}

const items = Array.isArray(list.json?.data) ? list.json.data : [];
console.log("total:", list.json?.total ?? items.length);
console.log("page:", list.json?.page, "resultsPerPage:", list.json?.resultsPerPage);

const listSample = items[0] ?? null;
printFieldDiff("List item vs invoice.Invoice model", MODEL_INVOICE_FIELDS, listSample);

if (listSample) {
  console.log("\n=== Sample list invoice (first record) ===");
  console.log(JSON.stringify(listSample, null, 2));

  const nested = {
    branch: listSample.branch,
    container: listSample.container,
    employee: listSample.employee,
    user: listSample.user,
    sender: listSample.sender,
    receiver: listSample.receiver,
    pickup: listSample.pickup,
    invoiceDetails: listSample.invoiceDetails,
  };

  for (const [name, value] of Object.entries(nested)) {
    if (value == null) {
      console.log(`\n--- ${name}: null/undefined ---`);
      continue;
    }
    if (Array.isArray(value)) {
      console.log(`\n--- ${name}: array[${value.length}] ---`);
      if (value[0]) {
        console.log("first item keys:", Object.keys(value[0]).join(", "));
        if (name === "invoiceDetails") {
          printFieldDiff("invoiceDetails[0] vs invoice.InvoiceDetail model", MODEL_INVOICE_DETAIL_FIELDS, value[0]);
          console.log(JSON.stringify(value[0], null, 2));
        }
      }
      continue;
    }
    console.log(`\n--- ${name} keys ---`);
    console.log(Object.keys(value).join(", "));
  }
}

const detailId = invoiceId || listSample?.id;
if (detailId) {
  console.log(`\n=== GET /invoices/${detailId} ===`);
  const detail = await request("GET", `/invoices/${detailId}`);
  console.log("status:", detail.status);

  const detailSample =
    detail.json && typeof detail.json === "object" && "data" in detail.json
      ? detail.json.data
      : detail.json;

  printFieldDiff("Detail vs invoice.Invoice model", MODEL_INVOICE_FIELDS, detailSample);

  if (detail.status === 200 && detailSample && typeof detailSample === "object") {
    const detailKeys = Object.keys(detailSample);
    const listKeys = listSample ? Object.keys(listSample) : [];
    const onlyInDetail = detailKeys.filter((key) => !listKeys.includes(key));
    const onlyInList = listKeys.filter((key) => !detailKeys.includes(key));

    console.log("\nFields only in detail response:", onlyInDetail.length ? onlyInDetail.join(", ") : "(none)");
    console.log("Fields only in list response:", onlyInList.length ? onlyInList.join(", ") : "(none)");

    const details = Array.isArray(detailSample.invoiceDetails) ? detailSample.invoiceDetails : [];
    if (details[0]) {
      printFieldDiff("Detail invoiceDetails[0] vs model", MODEL_INVOICE_DETAIL_FIELDS, details[0]);
    }
  } else {
    console.log(JSON.stringify(detail.json, null, 2));
  }
}
