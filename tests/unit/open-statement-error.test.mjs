import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOpenIncomeStatements,
  parseSingleOpenIncomeStatement,
} from "../../src/lib/accounting/daily-income/open-statement-error.ts";

test("parses a single previous open income statement", () => {
  const message =
    "previous income statements are still open: 32050 2026-04-13. Suggested solution: Close the listed income statements, then try again.";
  assert.deepEqual(parseOpenIncomeStatements(message), [{ id: 32050, date: "2026-04-13" }]);
  assert.deepEqual(parseSingleOpenIncomeStatement(message), { id: 32050, date: "2026-04-13" });
});

test("parses multiple previous open income statements", () => {
  const message =
    "previous income statements are still open: 32050 2026-04-13, 32492 2026-06-13, 32515 2026-06-16, 32582 2026-06-25, 32637 2026-07-03, 32666 2026-09-14. Suggested solution: Close the listed income statements, then try again.";
  assert.deepEqual(parseOpenIncomeStatements(message), [
    { id: 32050, date: "2026-04-13" },
    { id: 32492, date: "2026-06-13" },
    { id: 32515, date: "2026-06-16" },
    { id: 32582, date: "2026-06-25" },
    { id: 32637, date: "2026-07-03" },
    { id: 32666, date: "2026-09-14" },
  ]);
  assert.equal(parseSingleOpenIncomeStatement(message), null);
});

test("returns empty when the message has no id/date pairs", () => {
  assert.deepEqual(parseOpenIncomeStatements("Unable to create daily income statement."), []);
  assert.equal(parseSingleOpenIncomeStatement("Unable to create daily income statement."), null);
});
