import assert from "node:assert/strict";
import test from "node:test";
import {
  DuplicatePaymentCancelledError,
  isDuplicatePaymentWarning,
  journalPaymentFields,
  submitWithDuplicatePaymentConfirmation,
} from "../../src/lib/accounting/daily-income/duplicate-payment.ts";

const warning = () => ({
  isAxiosError: true,
  response: { status: 409, data: { message: "Duplicate payment warning" } },
});
const values = () => ({
  transactionType: "PAYMENT", amount: 12.5, invoiceId: "invoice-a",
  paymentMethodName: "ZELLE", externalReferenceNumber: "BANK-123",
  refNumber: "internal", description: "Payment",
});

test("successful payments never prompt or carry an override", async () => {
  const calls = [];
  await submitWithDuplicatePaymentConfirmation(values(), async (...args) => calls.push(args), async () => {
    assert.fail("Unexpected confirmation");
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [values()]);
});

test("cancel preserves the input and does not post a second payment", async () => {
  const input = values();
  let calls = 0;
  await assert.rejects(submitWithDuplicatePaymentConfirmation(input, async () => {
    calls += 1;
    throw warning();
  }, async () => false), DuplicatePaymentCancelledError);
  assert.equal(calls, 1);
  assert.deepEqual(input, values());
});

test("confirmed retry uses the original snapshot and the explicit override", async () => {
  const input = values();
  const calls = [];
  await submitWithDuplicatePaymentConfirmation(input, async (submitted, options) => {
    calls.push({ submitted: structuredClone(submitted), options });
    if (calls.length === 1) {
      submitted.amount = 999;
      throw warning();
    }
  }, async (displayed) => {
    assert.deepEqual(displayed, values());
    input.amount = 500;
    displayed.externalReferenceNumber = "changed";
    return true;
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { submitted: values(), options: { allowDuplicatePayment: true } });
});

test("unrelated conflicts, auth errors, and network errors never offer an override", async () => {
  for (const error of [
    { isAxiosError: true, response: { status: 409, data: { message: "Statement is closed" } } },
    { isAxiosError: true, response: { status: 403, data: { message: "Duplicate payment warning" } } },
    new Error("Network error"),
  ]) {
    assert.equal(isDuplicatePaymentWarning(error), false);
    await assert.rejects(submitWithDuplicatePaymentConfirmation(values(), async () => { throw error; }, async () => {
      assert.fail("Unexpected confirmation");
    }), (caught) => caught === error);
  }
});

test("failed confirmed retries propagate without a second confirmation or automatic retry", async () => {
  let calls = 0;
  let prompts = 0;
  await assert.rejects(submitWithDuplicatePaymentConfirmation(values(), async () => {
    calls += 1;
    throw warning();
  }, async () => { prompts += 1; return true; }), isDuplicatePaymentWarning);
  assert.equal(calls, 2);
  assert.equal(prompts, 1);
});

test("a subsequent save starts without the previous payment's override", async () => {
  let calls = 0;
  await submitWithDuplicatePaymentConfirmation(values(), async () => {
    if (++calls === 1) throw warning();
  }, async () => true);
  await submitWithDuplicatePaymentConfirmation(values(), async (_input, options) => {
    assert.equal(options, undefined);
  }, async () => assert.fail("Unexpected confirmation"));
});

test("payload standardizes references, permits clearing, and keeps override out of form state", () => {
  assert.deepEqual(journalPaymentFields({ externalReferenceNumber: "  bank-123  " }), {
    external_reference_number: "bank-123",
  });
  assert.deepEqual(journalPaymentFields({ externalReferenceNumber: "   " }), { external_reference_number: "" });
  assert.equal("allowDuplicatePayment" in journalPaymentFields({ allowDuplicatePayment: true }), false);
  assert.equal("allowDuplicatePayment" in journalPaymentFields({}, { allowDuplicatePayment: false }), false);
  assert.deepEqual(journalPaymentFields({}, { allowDuplicatePayment: true }), {
    external_reference_number: undefined, allowDuplicatePayment: true,
  });
});
