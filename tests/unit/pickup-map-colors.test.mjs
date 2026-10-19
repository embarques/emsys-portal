import assert from "node:assert/strict";
import test from "node:test";
import { buildPickupRouteColors, getPickupRouteColor, UNASSIGNED_PICKUP_COLOR } from "../../src/lib/orders/utils/pickup-map-colors.ts";

test("separate routes have separate colors and repeated route stops share one color", () => {
  const colors = buildPickupRouteColors(["route-b", "route-a", "route-b"]);
  assert.equal(colors.size, 2);
  assert.notEqual(colors.get("route-a"), colors.get("route-b"));
  assert.equal(getPickupRouteColor(colors, " route-b "), colors.get("route-b"));
});

test("stop order and repeated stops do not change route colors", () => {
  assert.deepEqual(buildPickupRouteColors(["b", "a", "b"]), buildPickupRouteColors(["a", "b"]));
});

test("unassigned stops retain blue and do not consume route colors", () => {
  const colors = buildPickupRouteColors([undefined, "", "  ", "a"]);
  assert.equal(colors.size, 1);
  for (const id of [undefined, "", "  "]) assert.equal(getPickupRouteColor(colors, id), UNASSIGNED_PICKUP_COLOR);
  assert.notEqual(colors.get("a"), UNASSIGNED_PICKUP_COLOR);
});

test("colors do not wrap to the beginning when the palette is exhausted", () => {
  const colors = buildPickupRouteColors(Array.from({ length: 100 }, (_, i) => `route-${i}`));
  assert.equal(new Set(colors.values()).size, 100);
  assert.ok([...colors.values()].every((color) => color !== UNASSIGNED_PICKUP_COLOR));
});
