# Route optimization audit — October 20, 2026

Route: `6ad6496d772f2f55f13eb783`, October 19, NY, Camion 1,
Basilio / BARRIENTO / ELKIN.

## Live request and response

Used the supplied credentials with `Authorization: Bearer …` and the supplied
company header. Credentials are excluded from this report and fixtures.
The audit exercised the application's API adapters, planning helper, optimization
mutation function, response normalization, stop-number mapping, and distance formatter.
HTTP transport and the React Query hook wrapper were replaced for the standalone audit.

All five requests returned HTTP 200:

| Request | Purpose | Observed elapsed time |
| --- | --- | --- |
| GET `/vehicle-routes/6ad6496d772f2f55f13eb783` | Confirm daily route | 192 ms |
| POST `/pickups/search?page=1&limit=100&offset=0` | Route-filtered pickups | 256 ms |
| POST `/pickups/search?page=2&limit=100&offset=100` | Remaining pickups | 269 ms |
| GET `/branches/1` | Branch depot | 94 ms |
| POST `/route-optimizer/single` | Optimization preview | 5,699 ms |

These are one-run network observations, not a performance benchmark.

Search used `route.id eq 6ad6496d772f2f55f13eb783`, sorted by date descending.
It returned 198 rows. Nine rows passed the existing verified-address/coordinate
filter and were sent to optimization. The preview therefore does not cover all
198 returned rows.

The optimizer body contains `start`, `end`, and nine `stops`. Both endpoints
are the branch address at 2249 Washington Avenue, with GeoJSON coordinates
`[-73.8939588, 40.854537799999996]`. Stops contain sender address snapshots,
including coordinates and verification metadata. The body does not send a daily
route ID, employee IDs, or vehicle ID; those determine the selected stops upstream.

The response contained one route, eleven ordered addresses (depot, nine stops,
depot), and `totalDistanceMeters: 232200`. The app formats this as `144.3 mi`.

## Confirmed defect and local correction

Every returned address, including both depot entries, had the same ID:
`000000000000000000000000`. ID-first matching consumed appointments in request
order, even assigning an appointment to the first depot entry.

The matcher now ignores the zero ID and uses coordinates for repeated IDs when
coordinates are returned. Depot coordinates do not match any of these nine
appointments, so depots do not consume stop numbers.

Replaying the captured response produced:

| Correct stop | Pickup ID | Previously displayed stop |
| --- | --- | --- |
| 1 | 21801 | 2 |
| 2 | 20794 | 9 |
| 3 | 20792 | 7 |
| 4 | 20793 | 8 |
| 5 | 21802 | 5 |
| 6 | 21807 | 4 |
| 7 | 21803 | 3 |
| 8 | 21800 | 6 |
| 9 | 21804 | 1 |

Code inspection confirms the map list sorts on this stop-number mapping and both
marker labels and list labels consume the same mapping. The distance badge uses
the tested formatter. Browser rendering and Google Maps interaction were not
exercised.

## Validation and limits

- All 15 focused optimizer/depot tests pass.
- Added a synthetic nine-stop regression with zero IDs, both depot entries,
  reversed response-array order, and the observed distance.
- Added coverage for repeated nonzero IDs at different locations.
- Updated an outdated endpoint-form test to supply the required address labels.
- Focused ESLint and `npx tsc --noEmit` pass.
- No additional application requests or dependencies are introduced by the fix.
- No route order was finalized or saved; no branch was updated.
- Changes are local and uncommitted.

Additional API observations: the route's stored `name` still references an older
date/crew although its structured date, crew, and vehicle match the requested
route. The paginated pickup results repeated pickup `20801` across pages.
These are separate data/pagination concerns; this audit does not establish their
cause. The repeated pickup was not among the nine optimized stops.
