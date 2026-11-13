import assert from "node:assert/strict";
import test from "node:test";
import {createPortalLoader} from "../../scripts/lib/portal-modules.mjs";

const statement = {id: 1, branch: {id: 2}, currency: "USD", rate: 1};
const values = {transactionType: "PAYMENT", amount: 80, invoiceId: "invoice-1", paymentMethodName: "ZELLE", paymentAccountId: 3, paymentAccountName: "Bank", paymentAccountType: "BANK", refNumberMode: "system", description: "Receipt"};
function fixture(post) {
  const load = createPortalLoader({apiClient: {post}});
  const {createJournalCreateSession} = load("src/lib/accounting/daily-income/journal-create-session.ts");
  let sequence = 0;
  return {submit: createJournalCreateSession(undefined, () => `request-${++sequence}`), load};
}

test("a committed create with a lost response retries the same receipt, then a new successful entry gets a new ID", async () => {
  const receipts = new Map();
  const calls = [];
  let loseResponse = true;
  const {submit} = fixture(async (url, body) => {
    calls.push({url, body: structuredClone(body)});
    if (!receipts.has(body.requestId)) receipts.set(body.requestId, {id: `journal-${receipts.size + 1}`});
    if (loseResponse) { loseResponse = false; throw new Error("Response lost after commit"); }
    return {success: true, data: receipts.get(body.requestId)};
  });
  await assert.rejects(submit("company-a:actor-a", statement, values), /Response lost/);
  assert.equal((await submit("company-a:actor-a", statement, {...values, invoiceBalance: 0})).id, "journal-1");
  assert.equal(receipts.size, 1);
  assert.equal(calls[0].url, "/journals/sync");
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal((await submit("company-a:actor-a", statement, values)).id, "journal-2");
  assert.equal(receipts.size, 2);
});

test("overlapping identical submissions share one in-flight posting", async () => {
  let calls = 0;
  const {submit} = fixture(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return {success: true, data: {id: "one"}}; });
  const results = await Promise.all([submit("scope", statement, values), submit("scope", statement, structuredClone(values))]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map(row => row.id), ["one", "one"]);
});

test("correcting a rejected payload or changing tenant/actor never reuses another payload's identity", async () => {
  const calls = [];
  const {submit} = fixture(async (_url, body) => {
    calls.push(structuredClone(body));
    if (body.entry.amount < 0) throw Object.assign(new Error("Invalid amount"), {status: 400});
    throw new Error("Uncertain response");
  });
  for (const [scope, input] of [["a:u1", {...values, amount: -1}], ["a:u1", values], ["b:u1", values], ["a:u2", values]]) await assert.rejects(submit(scope, statement, input));
  assert.equal(new Set(calls.map(call => call.requestId)).size, 4);
  assert.equal(calls[0].entry.amount, -1);
  assert.equal(calls[1].entry.amount, 80);
});

test("an explicit duplicate-payment override has its own payload-bound receipt", async () => {
  const calls = [];
  const {submit} = fixture(async (_url, body) => { calls.push(structuredClone(body)); if (!body.entry.allowDuplicatePayment) throw new Error("Duplicate payment warning"); return {success: true, data: {id: "confirmed"}}; });
  await assert.rejects(submit("scope", statement, values));
  await submit("scope", statement, values, {allowDuplicatePayment: true});
  assert.notEqual(calls[0].requestId, calls[1].requestId);
  assert.equal(calls[0].entry.allowDuplicatePayment, undefined);
  assert.equal(calls[1].entry.allowDuplicatePayment, true);
});

test("sync and ordinary creation preserve the same approval flags and payload", async () => {
  const calls = [];
  const {load} = fixture(async (url, body) => { calls.push({url, body}); return {success: true, data: {id: "entry"}}; });
  const api = load("src/lib/accounting/daily-income/api.ts");
  for (const input of [{...values, transactionType: "SALES", paymentMethodName: "CASH", autoClear: true}, {...values, transactionType: "INVENTORY", inventoryDirection: "dispatched", inventoryQuantity: 1, autoReconcile: true}]) {
    await api.createDailyIncomeJournal(statement, input);
    await api.createDailyIncomeJournalSync("request", statement, input);
    assert.deepEqual(calls.at(-2).body, calls.at(-1).body.entry);
  }
  assert.equal(calls[1].body.entry.autoClear, true);
  assert.equal(calls[3].body.entry.autoReconcile, true);
});

test("a malformed success remains uncertain and cannot become a fresh create on retry", async () => {
  const ids = [];
  const {submit} = fixture(async (_url, body) => { ids.push(body.requestId); return {success: true, data: {}}; });
  await assert.rejects(submit("scope", statement, values), /not confirmed/);
  await assert.rejects(submit("scope", statement, values), /not confirmed/);
  assert.deepEqual(ids, ["request-1", "request-1"]);
});
