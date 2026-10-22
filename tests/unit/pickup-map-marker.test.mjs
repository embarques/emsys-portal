import assert from "node:assert/strict";
import test from "node:test";
import {
  PICKUP_MARKER_BASE_SIZE,
  PICKUP_MARKER_MAX_SIZE,
  buildPickupTruckMarkerUrl,
  pickupMarkerSizeForZoom,
} from "../../src/lib/orders/utils/pickup-map-marker.ts";

function markerSvg(color, selected, stopNumber) {
  const url = buildPickupTruckMarkerUrl(color, selected, stopNumber);
  assert.match(url, /^data:image\/svg\+xml;charset=UTF-8,/);
  return decodeURIComponent(url.slice("data:image/svg+xml;charset=UTF-8,".length));
}

test("marker size is 32 at the default zoom and grows to 64 when zooming in", () => {
  assert.equal(pickupMarkerSizeForZoom(11), PICKUP_MARKER_BASE_SIZE);
  assert.equal(pickupMarkerSizeForZoom(11), 32);
  assert.ok(pickupMarkerSizeForZoom(13) > 32);
  assert.equal(pickupMarkerSizeForZoom(15), PICKUP_MARKER_MAX_SIZE);
  assert.equal(pickupMarkerSizeForZoom(20), 64);
  assert.equal(pickupMarkerSizeForZoom(6), 32);
});

test("stop numbers are painted in the cargo box instead of a map label", () => {
  const svg = markerSvg("#7c3aed", true, 1);
  assert.match(svg, />1<\/text>/);
  assert.match(svg, /font-size="18"/);
  assert.match(svg, /text-anchor="middle"/);
  assert.match(svg, /x="17"/);
  assert.equal(markerSvg("#7c3aed", false).includes("<text"), false);
});

test("two- and three-digit stop numbers stay inside the cargo box", () => {
  assert.match(markerSvg("#2563eb", false, 10), /font-size="16"/);
  assert.match(markerSvg("#2563eb", false, 10), />10<\/text>/);
  assert.match(markerSvg("#2563eb", false, 120), /font-size="13"/);
  assert.match(markerSvg("#2563eb", false, 120), />120<\/text>/);
});
