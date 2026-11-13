#!/usr/bin/env node
/** Opt-in isolated customer fixtures and impossible-ID loan contract probe. */
import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {createApiSuite} from "./lib/api-suite.mjs";
import {createPortalLoader, createHttpApiClient} from "./lib/portal-modules.mjs";
const suite = createApiSuite({title: "Portal boundary verification", options: {writeFixtures: {flag: "--write-fixtures"}, loanOnly: {flag: "--loan-only"}, output: {flag: "--output", takesValue: true}}});
const evidence = [], customers = [];
const createdIds = new Set();
const marker = `CODEX-PORTAL-${randomUUID()}`;
async function request(method, path, body, extraHeaders) {
  const response = await fetch(suite.opts.baseUrl + path, {method, headers: {Authorization: `Bearer ${suite.opts.token.replace(/^Bearer\s+/i, "")}`, "x-company-id": suite.opts.companyId, "content-type": "application/json", ...extraHeaders}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(30_000)});
  const raw = await response.text();
  let json; try { json = JSON.parse(raw); } catch { json = {raw: raw.slice(0, 400)}; }
  if (method === "POST" && path === "/customers" && json?.data?.id) createdIds.add(json.data.id);
  evidence.push({method, path, ...(method === "PUT" ? {body} : {}), http: response.status, response: json});
  return {status: response.status, json};
}
function verify(label, condition) { if (condition) suite.pass(label); else suite.fail(label, 0, "Persisted invariant failed"); }
const load = createPortalLoader({apiClient: createHttpApiClient(request)});
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) suite.note("No writes; use --write-fixtures in the approved mock company.");
  else {
    if (!suite.opts.loanOnly) {
    const api = load("src/lib/customers/api/customers-api.ts");
    const types = load("src/lib/customers/types.ts");
    for (let index = 0; index < 2; index++) {
      const empty = types.createEmptyCustomerForm();
      const values = {...empty, name: `${marker}-${index}`, customerType: 1, active: true, branch: {id: 1, name: "Embarque Tenares", code: "NY"}, phones: [{type: "mobile", number: index === 0 ? "+12025550101" : "+12025550102", isPrimary: true}], addresses: [{...empty.addresses[0], address1: "1 Fixture St", city: "Bronx", state: "NY", zipcode: "10451", country: "US", isPrimary: true}]};
      const customer = await api.createCustomer(values);
      customers.push(customer);
      suite.pass("Create isolated customer through real portal adapter");
    }
    const original = types.customerToFormValues(customers[0]);
    const changed = {...structuredClone(original), addresses: original.addresses.map(address => ({...address, city: "Brooklyn"}))};
    const saved = await api.updateCustomer(customers[0].id, changed, original);
    const write = evidence.find(row => row.method === "PUT");
    verify("Address-only portal payload omits name and phones", write && !Object.hasOwn(write.body, "name") && !Object.hasOwn(write.body, "phones"));
    verify("Address update persists without replacing customer identity", saved.id === customers[0].id && saved.name === customers[0].name && saved.addresses.some(address => address.city === "Brooklyn"));
    const second = types.customerToFormValues(customers[1]);
    let conflict;
    try { await api.updateCustomer(customers[1].id, {...second, name: original.name, phones: original.phones}, second); }
    catch (error) { conflict = error; }
    verify("Genuine duplicate identity change is rejected", conflict?.response?.status === 409);
    const control = await api.fetchCustomerById(customers[1].id);
    verify("Rejected identity change preserves original customer", control.name === customers[1].name);
    }
    // Loans use integer IDs. Establish a nonexistent positive ID before probing.
    const absentLoan = await request("GET", "/loans/2147483646");
    if (absentLoan.status !== 404) throw new Error("Absent loan control not established; no increase probe sent");
    try {
      await load("src/lib/accounting/loans/api.ts").increaseLoan({loanId: "2147483646", employeeId: 2147483646, employeeName: marker, sourceAccountId: 2147483646, sourceAccountName: marker, sourceAccountType: "ASSET", amount: 1, transactionDate: new Date().toISOString().slice(0,10), referenceNumber: marker, description: marker});
      suite.fail("Impossible loan increase rejected", 0, "Unexpected success");
    } catch (error) { suite.note(`Loan increase negative-path response HTTP ${error.response?.status ?? 0}; see evidence. This does not certify a valid loan increase.`); }
  }
} catch (error) { suite.fail("Portal boundary fixture prerequisites", error.response?.status ?? 0, error.message); }
finally {
  for (const id of createdIds) {
    try {
      const saved = await request("GET", `/customers/${id}`);
      const deleted = await request("DELETE", `/customers/${id}`, undefined, {"If-Match": `"${saved.json.data.version}"`});
      verify(`Remove isolated customer ${id}`, suite.ok(deleted) && (await request("GET", `/customers/${id}`)).status === 404);
    } catch (error) { suite.fail(`Customer cleanup ${id}`, 0, error.message); }
  }
}
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), marker, evidence}, null, 2));
suite.finish("Portal boundary checks complete; legacy duplicate-history fixtures remain separate.");
