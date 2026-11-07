# Route optimization — remaining verification

- Verify browser map markers, list order, depot handling and distance display
  agree with the returned plan, including repeated/zero address IDs and stops
  without eligible verified coordinates.
- Recheck duplicate pickups across server pages with a stable dataset, explicit
  sorting and concurrent changes before assigning a pagination root cause.
- Recheck stored daily-route display names against structured date/crew/vehicle
  fields after edits; determine whether stale names need a backend repair.

Use representative non-production data for network/latency measurements and
keep preview verification separate from persisting route order.
