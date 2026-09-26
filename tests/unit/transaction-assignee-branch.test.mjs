import assert from "node:assert/strict";
import test from "node:test";

import {
  dailyRoutesForAssigneeBranch,
  employeesForAssigneeBranch,
  resolveAssigneeBranchId,
} from "../../src/lib/accounting/daily-income/assignee-branch.ts";

test("employeesForAssigneeBranch filters by branch id", () => {
  const employees = [
    { id: 1, name: "A", branch: { id: 10, name: "NY", code: "NY" } },
    { id: 2, name: "B", branch: { id: 20, name: "RD", code: "RD" } },
  ];
  assert.deepEqual(
    employeesForAssigneeBranch(employees, 10).map((item) => item.id),
    [1],
  );
  assert.equal(employeesForAssigneeBranch(employees, null).length, 2);
  assert.equal(employeesForAssigneeBranch(employees, undefined).length, 2);
});

test("dailyRoutesForAssigneeBranch filters by branch id", () => {
  const routes = [
    { id: "a", branch: { id: 10, code: "NY" } },
    { id: "b", branch: { id: 20, code: "RD" } },
    { id: "c", branch: null },
  ];
  assert.deepEqual(
    dailyRoutesForAssigneeBranch(routes, 10).map((item) => item.id),
    ["a"],
  );
  assert.equal(dailyRoutesForAssigneeBranch(routes, 0).length, 3);
});

test("resolveAssigneeBranchId prefers statement, then employee, then route", () => {
  assert.equal(
    resolveAssigneeBranchId({
      statementBranchId: 7,
      employee: { branch: { id: 1, name: "A", code: "A" } },
      route: { branch: { id: 2, code: "B" } },
    }),
    7,
  );
  assert.equal(
    resolveAssigneeBranchId({
      employee: { branch: { id: 1, name: "A", code: "A" } },
      route: { branch: { id: 2, code: "B" } },
    }),
    1,
  );
  assert.equal(
    resolveAssigneeBranchId({
      route: { branch: { id: 2, code: "B" } },
    }),
    2,
  );
  assert.equal(resolveAssigneeBranchId({}), undefined);
});
