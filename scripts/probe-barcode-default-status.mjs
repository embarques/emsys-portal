#!/usr/bin/env node
/**
 * Probe: new barcode creates default to branch defaultLabelStatus when status
 * is omitted/empty, hydrated from tenant barcode_statuses.
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' node scripts/probe-barcode-default-status.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819
 *   EMSYS_PROBE_INVOICE=1
 *   EMSYS_FLIP_DEFAULT=1   # temporarily set branch defaultLabelStatus to 4 (ALM-RD)
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "64d5c0b0d1eab2aaf30b1819").trim();
const probeInvoice = process.env.EMSYS_PROBE_INVOICE === "1";
const flipDefault = process.env.EMSYS_FLIP_DEFAULT === "1";
const FLIP_TO = 4; // ALM-RD — distinct from typical default 1

if (!rawToken) {
  console.error("Set EMSYS_TOKEN.");
  process.exit(1);
}

const authValue = rawToken.toLowerCase().startsWith("bearer ") ? rawToken : `Bearer ${rawToken}`;
const headers = {
  accept: "application/json",
  Authorization: authValue,
  "X-Company-ID": companyId,
  "Content-Type": "application/json",
};

const stamp = Date.now();
const results = { passed: [], failed: [], notes: [], createdBarcodeIds: [] };

function pass(label, detail = "") {
  results.passed.push({ label, detail });
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  results.failed.push({ label, detail });
  console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
}
function note(msg) {
  results.notes.push(msg);
  console.log(`  [NOTE] ${msg}`);
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return {
    status: response.status,
    json,
    ok: response.status >= 200 && response.status < 300 && json?.success !== false,
  };
}

function unwrap(res) {
  return res.json?.data ?? res.json;
}

function branchPutBody(branch, defaultLabelStatus) {
  return {
    name: branch.name,
    type: branch.type,
    code: branch.code,
    phones: branch.phones,
    logo: branch.logo ?? "",
    disclaimer: branch.disclaimer ?? "",
    address: {
      address1: branch.address?.address1 ?? "",
      city: branch.address?.city ?? "",
      state: branch.address?.state ?? "",
      zipcode: branch.address?.zipcode ?? "",
      country: branch.address?.country ?? "US",
    },
    settings: {
      labelPrefix: branch.settings.labelPrefix,
      printLabelCount: branch.settings.printLabelCount,
      roundDecimalPlaces: branch.settings.roundDecimalPlaces,
      defaultLabelStatus,
    },
  };
}

function assertStatus(label, actual, expected) {
  const id = actual?.id;
  const name = actual?.name;
  const idOk = Number(id) === Number(expected.id);
  const nameOk =
    typeof name === "string" &&
    name.trim().toUpperCase() === String(expected.name).trim().toUpperCase();
  if (idOk && nameOk) {
    pass(label, `status=${JSON.stringify(actual)}`);
    return true;
  }
  fail(label, `expected {id:${expected.id},name:"${expected.name}"}, got ${JSON.stringify(actual ?? null)}`);
  return false;
}

console.log("Barcode defaultLabelStatus probe");
console.log(`Base: ${baseUrl}`);
console.log(`Company: ${companyId}\n`);

// Resolve actor via /users/me uid + /users/search (me alone is Firebase-only)
const me = await request("GET", "/users/me");
if (!me.ok) {
  fail("GET /users/me", `HTTP ${me.status}`);
  process.exit(1);
}
const uid = unwrap(me)?.uid;
pass("GET /users/me", `uid=${uid}`);

const userSearch = await request("POST", "/users/search?page=1&limit=5&offset=0", {
  operator: "and",
  filters: [{ field: "uid", operator: "eq", value: uid }],
});
let actor =
  (Array.isArray(unwrap(userSearch)) ? unwrap(userSearch) : userSearch.json?.data)?.[0] ?? null;
if (!actor) {
  const fallback = await request("POST", "/users/search?page=1&limit=5&offset=0", {
    operator: "or",
    filters: [{ field: "email", operator: "contains", value: "elk" }],
  });
  actor = (fallback.json?.data ?? []).find((u) => u.uid === uid) ?? fallback.json?.data?.[0] ?? null;
}
if (!actor?.branch?.id) {
  fail("actor branch", "could not resolve user branch");
  process.exit(1);
}
pass("actor", `id=${actor.id} branch=${actor.branch.id} (${actor.branch.name})`);

const branchRes = await request("GET", `/branches/${actor.branch.id}`);
const branch = unwrap(branchRes);
if (!branchRes.ok || !branch) {
  fail("GET branch", `HTTP ${branchRes.status}`);
  process.exit(1);
}
const originalDefault = Number(branch.settings?.defaultLabelStatus ?? 0);
pass("branch defaultLabelStatus (original)", String(originalDefault));

const catalogRes = await request("GET", "/barcodes/status-options");
const catalog = Array.isArray(unwrap(catalogRes)) ? unwrap(catalogRes) : catalogRes.json?.data ?? [];
pass("status-options", `${catalog.length} rows`);

let effectiveDefault = originalDefault;
if (flipDefault) {
  const put = await request("PUT", `/branches/${branch.id}`, branchPutBody(branch, FLIP_TO));
  if (!put.ok) {
    fail("flip defaultLabelStatus", `HTTP ${put.status}`);
  } else {
    effectiveDefault = FLIP_TO;
    pass("flip defaultLabelStatus", `${originalDefault} -> ${FLIP_TO}`);
  }
}

const expected = catalog.find((s) => Number(s.id) === effectiveDefault);
if (!expected) {
  fail("catalog row for default", `id=${effectiveDefault}`);
  process.exit(1);
}
pass("expected hydrated status", JSON.stringify(expected));

async function createBarcode(label, body) {
  const create = await request("POST", "/barcodes", body);
  const data = unwrap(create);
  const id = data?.id;
  if (!create.ok || id == null) {
    fail(label, `HTTP ${create.status} ${JSON.stringify(create.json).slice(0, 200)}`);
    return;
  }
  results.createdBarcodeIds.push(id);
  assertStatus(`${label} create`, data?.status, expected);
  const read = await request("GET", `/barcodes/${id}`);
  assertStatus(`${label} GET`, unwrap(read)?.status, expected);
}

console.log("\n=== POST /barcodes (actor branch default) ===");
await createBarcode("omit status", { number: `ZZ_DEFSTAT_OMIT_${stamp}` });
await createBarcode("status null", { number: `ZZ_DEFSTAT_NULL_${stamp}`, status: null });
await createBarcode("status {}", { number: `ZZ_DEFSTAT_EMPTY_${stamp}`, status: {} });
await createBarcode("status blank", { number: `ZZ_DEFSTAT_BLANK_${stamp}`, status: { id: 0, name: "" } });
await createBarcode("status id only (hydrate control)", {
  number: `ZZ_DEFSTAT_IDONLY_${stamp}`,
  status: { id: expected.id },
});

if (probeInvoice) {
  console.log("\n=== Invoice-embedded labels ===");
  const incomeList = await request("GET", "/income-statements?page=1&limit=20&sort=id:desc");
  const openIncome = (incomeList.json?.data ?? []).find(
    (row) => row.status === "open" && Number(row.branch?.id) === Number(branch.id),
  );
  const customer = (await request("GET", "/customers?page=1&limit=1&sort=id:desc")).json?.data?.[0];
  const container = (await request("GET", "/containers?page=1&limit=1&sort=id:desc")).json?.data?.[0];
  const employee = (await request("GET", "/employees?page=1&limit=1&sort=id:desc")).json?.data?.[0];

  if (!openIncome || !customer || !container || !employee) {
    fail("invoice prerequisites", "need open income statement + customer + container + employee");
  } else {
    const invBody = {
      number: `ZZ-DS-${stamp}`,
      date: openIncome.date,
      incomeStatement: { id: openIncome.id },
      branch: { id: branch.id, name: branch.name, code: branch.code },
      cost: 1,
      payment: 0,
      balance: 1,
      discount: 0,
      surcharge: 0,
      paidRegion: "",
      paidStatus: "",
      employee: { id: Number(employee.id), name: employee.name },
      receivedBy: { id: Number(employee.id), name: employee.name },
      container: { id: container.id, name: container.name ?? String(container.id) },
      sender: {
        id: customer.id,
        name: customer.name,
        customerType: customer.customerType ?? 1,
        phone1: customer.phones?.[0]?.number ?? "555-0000",
      },
      receiver: { name: `Probe Receiver ${stamp}`, customerType: 2, phone1: "555-0001" },
      invoiceDetails: [
        {
          name: `defstat probe ${stamp}`,
          description: `defstat probe ${stamp}`,
          quantity: 1,
          labels: 2,
          price: 1,
          total: 1,
        },
      ],
    };
    const created = await request("POST", "/invoices", invBody);
    if (!created.ok) {
      fail("POST /invoices", `HTTP ${created.status} ${JSON.stringify(created.json).slice(0, 300)}`);
    } else {
      const invId = unwrap(created)?.id;
      pass("POST /invoices", `id=${invId}`);
      const detail = await request("GET", `/invoices/${invId}`);
      const barcodes = (unwrap(detail)?.invoiceDetails ?? []).flatMap((d) => d.barcodes ?? []);
      if (!barcodes.length) fail("invoice embedded barcodes", "none returned");
      for (const [i, bc] of barcodes.entries()) {
        assertStatus(`invoice label[${i}]`, bc.status, expected);
      }
      const del = await request("DELETE", `/invoices/${invId}`);
      if (del.ok) pass(`DELETE /invoices/${invId}`);
      else note(`DELETE invoice HTTP ${del.status}`);
    }
  }
} else {
  note("Skip invoice probe (set EMSYS_PROBE_INVOICE=1)");
}

console.log("\n=== Cleanup ===");
for (const id of results.createdBarcodeIds) {
  const del = await request("DELETE", `/barcodes/${id}`);
  if (del.ok || del.status === 404) pass(`DELETE /barcodes/${id}`);
  else note(`DELETE /barcodes/${id} HTTP ${del.status}`);
}

if (flipDefault) {
  const restore = await request("PUT", `/branches/${branch.id}`, branchPutBody(branch, originalDefault));
  const check = unwrap(await request("GET", `/branches/${branch.id}`));
  if (restore.ok && Number(check?.settings?.defaultLabelStatus) === originalDefault) {
    pass("restore defaultLabelStatus", String(originalDefault));
  } else {
    fail("restore defaultLabelStatus", JSON.stringify(check?.settings));
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) {
  console.log("Notes:");
  for (const n of results.notes) console.log(`  - ${n}`);
}
if (results.failed.length) {
  console.log("Failures:");
  for (const f of results.failed) console.log(`  - ${f.label}: ${f.detail}`);
  process.exit(1);
}
console.log("All checks passed.");
