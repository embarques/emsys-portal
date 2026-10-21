import assert from "node:assert/strict";
import test from "node:test";
import {
  assignManualStopNumber,
  assignOptimizedStopNumbers,
} from "../../src/lib/route-optimizer/stop-numbers.ts";

test("manual number moves a stop and renumbers the rest without gaps", () => {
  const current = { a: 1, b: 2, c: 3 };
  assert.deepEqual(assignManualStopNumber(current, "c", 1), { c: 1, a: 2, b: 3 });
  assert.deepEqual(assignManualStopNumber(current, "a", 3), { b: 1, c: 2, a: 3 });
});

test("manual number inserts an unnumbered stop and clamps past the end", () => {
  assert.deepEqual(assignManualStopNumber({ a: 1, b: 2 }, "c", 2), { a: 1, c: 2, b: 3 });
  assert.deepEqual(assignManualStopNumber({ a: 1 }, "b", 99), { a: 1, b: 2 });
  assert.deepEqual(assignManualStopNumber({}, "a", 0), { a: 1 });
});

test("a number at or past the last stop moves that stop last and shifts the rest up", () => {
  const current = { a: 1, b: 2, c: 3, d: 4 };
  assert.deepEqual(assignManualStopNumber(current, "b", 4), { a: 1, c: 2, d: 3, b: 4 });
  assert.deepEqual(assignManualStopNumber(current, "a", 100), { b: 1, c: 2, d: 3, a: 4 });
  assert.deepEqual(assignManualStopNumber(current, "d", 100), current);
});

test("clearing a manual number closes the gap", () => {
  assert.deepEqual(assignManualStopNumber({ a: 1, b: 2, c: 3 }, "b", null), { a: 1, c: 2 });
});

function result(addresses) {
  return {
    numRoutes: 1,
    totalDistanceMeters: 0,
    routes: [{ routeNumber: 1, distanceMeters: 0, addresses }],
  };
}

test("stop numbers follow the optimized address order", () => {
  const stops = [
    { key: "101", addressId: "a", coordinates: [-73.9, 40.7] },
    { key: "102", addressId: "b", coordinates: [-73.8, 40.6] },
    { key: "103", addressId: "c", coordinates: [-73.7, 40.5] },
  ];

  const numbers = assignOptimizedStopNumbers(
    stops,
    result([
      { id: "c", routeOrder: 0, coordinates: null },
      { id: "a", routeOrder: 1, coordinates: null },
      { id: "b", routeOrder: 2, coordinates: null },
    ]),
  );

  assert.deepEqual(numbers, { 103: 1, 101: 2, 102: 3 });
});

test("appointments sharing one sender address each get their own stop number", () => {
  const stops = [
    { key: "201", addressId: "shared", coordinates: [-73.9, 40.7] },
    { key: "202", addressId: "shared", coordinates: [-73.9, 40.7] },
  ];

  const numbers = assignOptimizedStopNumbers(
    stops,
    result([
      { id: "shared", routeOrder: 0, coordinates: null },
      { id: "shared", routeOrder: 1, coordinates: null },
    ]),
  );

  assert.deepEqual(numbers, { 201: 1, 202: 2 });
});

test("falls back to coordinates when the optimizer omits address ids", () => {
  const stops = [
    { key: "301", coordinates: [-73.9, 40.7] },
    { key: "302", coordinates: [-73.8, 40.6] },
  ];

  const numbers = assignOptimizedStopNumbers(
    stops,
    result([
      { id: "", routeOrder: 0, coordinates: [-73.8, 40.6] },
      { id: "", routeOrder: 1, coordinates: [-73.9, 40.7] },
    ]),
  );

  assert.deepEqual(numbers, { 302: 1, 301: 2 });
});

test("unmatched optimizer addresses do not consume stop numbers", () => {
  const stops = [{ key: "401", addressId: "a" }, { key: "402", addressId: "b" }];

  const numbers = assignOptimizedStopNumbers(
    stops,
    result([
      { id: "unknown", routeOrder: 0, coordinates: null },
      { id: "b", routeOrder: 1, coordinates: null },
      { id: "a", routeOrder: 2, coordinates: null },
    ]),
  );

  assert.deepEqual(numbers, { 402: 1, 401: 2 });
});

test("repeated nonzero address IDs use coordinates to identify each appointment", () => {
  const stops = [
    { key: "a", addressId: "shared", coordinates: [-73, 40] },
    { key: "b", addressId: "shared", coordinates: [-74, 41] },
  ];
  assert.deepEqual(assignOptimizedStopNumbers(stops, result([
    { id: "shared", routeOrder: 1, coordinates: [-74, 41] },
    { id: "shared", routeOrder: 2, coordinates: [-73, 40] },
  ])), { b: 1, a: 2 });
});
