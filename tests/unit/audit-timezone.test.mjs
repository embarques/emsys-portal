import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAuditDate, formatAuditDateTime } from "../../src/lib/audit/display.ts";

test("audit instants use the business timezone independently of the browser timezone", () => {
  const previousTZ = process.env.TZ;
  const previousAppTZ = process.env.NEXT_PUBLIC_APP_TIMEZONE;
  try {
    delete process.env.NEXT_PUBLIC_APP_TIMEZONE;
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      assert.equal(formatAuditDateTime("2026-10-18T03:30:00Z"), "Oct 17, 2026, 11:30 PM EDT");
      assert.equal(formatAuditDateTime("2026-01-18T04:30:00Z"), "Jan 17, 2026, 11:30 PM EST");
      assert.equal(formatAuditDate("2026-10-17"), "Oct 17, 2026");
    }
    process.env.NEXT_PUBLIC_APP_TIMEZONE = "America/Santo_Domingo";
    assert.match(formatAuditDateTime("2026-01-18T04:30:00Z"), /Jan 18, 2026, 12:30 AM/);
    process.env.NEXT_PUBLIC_APP_TIMEZONE = "invalid-zone";
    assert.equal(formatAuditDateTime("2026-10-18T03:30:00Z"), "Oct 17, 2026, 11:30 PM EDT");
    assert.equal(formatAuditDateTime(""), "—");
    assert.equal(formatAuditDateTime("invalid"), "—");
  } finally {
    if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ;
    if (previousAppTZ === undefined) delete process.env.NEXT_PUBLIC_APP_TIMEZONE; else process.env.NEXT_PUBLIC_APP_TIMEZONE = previousAppTZ;
  }
});
