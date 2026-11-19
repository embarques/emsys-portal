import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function load(relative) {
  const filename = path.join(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  function localRequire(specifier) {
    if (specifier === "axios") return { isAxiosError: (error) => Boolean(error?.isAxiosError) };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      throw new Error(`unexpected import ${specifier}`);
    }
    return require(specifier);
  }
  new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const {
  isDuplicatePendingAppointmentWarning,
  getExistingPendingAppointmentsFromError,
  createWithDuplicatePendingAppointmentConfirmation,
  DuplicatePendingAppointmentCancelledError,
} = load("src/lib/orders/duplicate-pending-appointment.ts");

function conflictError(data) {
  return {
    isAxiosError: true,
    response: {
      status: 409,
      data,
    },
  };
}

test("detects duplicate pending appointment by message", () => {
  assert.equal(
    isDuplicatePendingAppointmentWarning(
      conflictError({ message: "Duplicate pending appointment warning" }),
    ),
    true,
  );
});

test("detects duplicate pending appointment by data.code", () => {
  assert.equal(
    isDuplicatePendingAppointmentWarning(
      conflictError({ data: { code: "DUPLICATE_PENDING_APPOINTMENT" } }),
    ),
    true,
  );
  assert.equal(isDuplicatePendingAppointmentWarning(conflictError({ message: "Other conflict" })), false);
});

test("reads existing appointments from conflict payload", () => {
  const existing = getExistingPendingAppointmentsFromError(
    conflictError({
      message: "Duplicate pending appointment warning",
      data: {
        code: "DUPLICATE_PENDING_APPOINTMENT",
        existingAppointments: [
          { id: 12, date: "2026-11-18T00:00:00Z", purpose: "PICKUP" },
          { id: "bad" },
        ],
      },
    }),
  );
  assert.deepEqual(existing, [{ id: 12, date: "2026-11-18T00:00:00Z", purpose: "PICKUP" }]);
});

test("retries create only after explicit confirmation", async () => {
  const calls = [];
  const values = { senderId: "abc" };
  const created = { id: 99 };

  const result = await createWithDuplicatePendingAppointmentConfirmation(
    values,
    async (submitted, options) => {
      calls.push({ submitted, options });
      if (!options?.allowDuplicatePendingAppointment) {
        throw conflictError({
          message: "Duplicate pending appointment warning",
          data: {
            code: "DUPLICATE_PENDING_APPOINTMENT",
            existingAppointments: [{ id: 7, date: "2026-11-18", purpose: "TAKE" }],
          },
        });
      }
      return created;
    },
    async (existing) => {
      assert.equal(existing[0].id, 7);
      return true;
    },
  );

  assert.equal(result, created);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.allowDuplicatePendingAppointment, true);
});

test("cancelled confirmation does not retry", async () => {
  await assert.rejects(
    () =>
      createWithDuplicatePendingAppointmentConfirmation(
        { senderId: "abc" },
        async () => {
          throw conflictError({ message: "Duplicate pending appointment warning", data: { code: "DUPLICATE_PENDING_APPOINTMENT" } });
        },
        async () => false,
      ),
    (error) => error instanceof DuplicatePendingAppointmentCancelledError,
  );
});

test("unrelated conflicts never offer a duplicate override", async () => {
  const error = conflictError({ message: "Different conflict", data: { code: "STALE_RECORD" } });
  let confirmations = 0;
  await assert.rejects(() => createWithDuplicatePendingAppointmentConfirmation(
    { senderId: "abc" }, async () => { throw error; },
    async () => { confirmations++; return true; },
  ), (actual) => actual === error);
  assert.equal(confirmations, 0);
});

test("failed confirmed create is surfaced without another retry", async () => {
  const failure = new Error("Connection failed");
  let attempts = 0;
  let confirmations = 0;
  await assert.rejects(() => createWithDuplicatePendingAppointmentConfirmation(
    { senderId: "abc" }, async (_values, options) => {
      attempts++;
      if (!options?.allowDuplicatePendingAppointment) throw conflictError({ message: "Duplicate pending appointment warning" });
      throw failure;
    },
    async () => { confirmations++; return true; },
  ), (actual) => actual === failure);
  assert.equal(attempts, 2);
  assert.equal(confirmations, 1);
});
