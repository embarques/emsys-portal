import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

const load = createPortalLoader({ apiClient: {} });
const { normalizeUserActivity } = load("src/lib/user-activities/api/user-activities-api.ts");
const { formatUserActivityRoute } = load("src/lib/user-activities/display.ts");

test("event type and barcode route changes are kept from the API activity", () => {
  const activity = normalizeUserActivity({
    activityId: "a-1", id: "barcode-1", origin: "barcodes", timestamp: "2026-11-13T12:00:00Z",
    eventType: "BARCODE_DAILY_ROUTE_CHANGED", description: "Undelivered barcode left its daily route",
    barcodeRouteChange: {
      barcodeId: "bc-1", previousTripNumber: 2,
      previous: { id: "route-a", name: "North", dailyRoute: { date: "2026-11-13" } },
      next: null,
    },
  });
  assert.equal(activity.eventType, "BARCODE_DAILY_ROUTE_CHANGED");
  assert.deepEqual(activity.routeChange, {
    barcodeId: "bc-1",
    previous: { id: "route-a", name: "North", date: "2026-11-13" },
    next: null,
    previousTripNumber: 2,
  });
  assert.equal(formatUserActivityRoute(activity.routeChange.previous), "North (2026-11-13)");
});

test("older activities without event metadata still normalize", () => {
  const activity = normalizeUserActivity({ activityId: "a-2", id: "x", origin: "invoices", barcodeRouteChange: { previous: {} } });
  assert.equal(activity.eventType, "");
  assert.equal(activity.routeChange, null);
  assert.equal(formatUserActivityRoute({ id: "route-b", name: "", date: "" }), "route-b");
});
