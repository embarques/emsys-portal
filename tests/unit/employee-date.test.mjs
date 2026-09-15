import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmployeeDate, employeeDateToInputValue } from "../../src/lib/employees/utils/employee-date.ts";

test("employee dates accept date-only and RFC3339 values", () => {
  assert.equal(normalizeEmployeeDate(" 2024-02-29 "), "2024-02-29T00:00:00.000Z");
  assert.equal(normalizeEmployeeDate("2024-02-29T00:00:00Z"), "2024-02-29T00:00:00.000Z");
  assert.equal(normalizeEmployeeDate("2024-02-29t00:00:00z"), "2024-02-29T00:00:00.000Z");
  assert.equal(normalizeEmployeeDate("2024-02-29T23:30:00-05:00"), "2024-03-01T04:30:00.000Z");
  assert.equal(normalizeEmployeeDate("2024-03-01T00:30:00+02:00"), "2024-02-29T22:30:00.000Z");
  assert.equal(normalizeEmployeeDate("2024-02-29T23:30:00.123456789-05:00"), "2024-03-01T04:30:00.123456789Z");
  assert.equal(normalizeEmployeeDate(" "), "");
});

test("invalid dates, ambiguous formats, and missing zones are rejected", () => {
  for (const value of ["2023-02-29", "2024-02-30", "2024-04-31", "2024-00-01", "2024-13-01", "2024-01-00", "02/29/2024", "2024-2-9", "invalid", "2024-02-29T00:00:00", "2024-02-29T24:00:00Z", "2024-02-29T12:60:00Z", "2024-02-29T12:00:61Z", "2024-02-29T00:00:00+24:00", "2024-02-29T00:00:00+01:60", "9999-12-31T23:30:00-01:00"]) {
    assert.throws(() => normalizeEmployeeDate(value), /valid YYYY-MM-DD/, value);
  }
});

test("normalization is idempotent and independent of the host timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["America/New_York", "Pacific/Auckland", "UTC"]) {
      process.env.TZ = timezone;
      for (const value of ["2026-03-08", "2026-11-01", "2024-02-29T23:30:00.00001-05:00"]) {
        const normalized = normalizeEmployeeDate(value);
        assert.equal(normalizeEmployeeDate(normalized), normalized);
        if (value.length === 10) assert.equal(normalized, `${value}T00:00:00.000Z`);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("calendar input accepts existing timestamps without a host-timezone shift", () => {
  assert.equal(employeeDateToInputValue("2024-02-29"), "2024-02-29");
  assert.equal(employeeDateToInputValue("2024-02-29T00:00:00Z"), "2024-02-29");
  assert.equal(employeeDateToInputValue("2024-03-01T00:30:00+02:00"), "2024-02-29");
  assert.equal(employeeDateToInputValue(""), "");
  assert.equal(employeeDateToInputValue("2024-02-30"), "");
});
