# Predefined routes

Predefined routes are named coverage filters for pickup customer addresses. They are separate from route crews and dated working routes.

## Portal

Routes → Predefined routes replaces Legacy routes. The server-paginated catalog shows ID, name, Cities, ZIP codes, and permission-gated Edit/Delete actions. Each coverage cell initially shows at most five entries and can expand.

The existing form stays intact: route name and one ordered mixed list of city/ZIP textboxes, comma-paste splitting, add/remove rows, duplicate normalization, and unchanged-save detection. US five-digit and ZIP+4 entries are classified as ZIP codes; other entries are cities. Leading zeros remain intact. One nonblank entry is required; limits are 200 name characters, 1,000 entries, and 65,536 content characters.

The appointment filter has a separated ROUTE row below New filter, with more vertical spacing. All routes removes only its restriction. Add opens the same form, selects the created route, and resets pagination. Edit/Delete remain in the catalog. The same controls work on mobile. The application startup loader was verified at 320px, 390px, and desktop widths.

## API contract

- GET `/v1/predefined-routes` and POST `/v1/predefined-routes/search`: paginated catalog/search.
- GET `/v1/predefined-routes/{id}`: detail.
- POST `/v1/predefined-routes`, PUT `/v1/predefined-routes/{id}`: `{ "name": "Miami Sur", "content": "Kendall, 33157, Cutler Bay, Homestead, 33030" }`.
- DELETE `/v1/predefined-routes/{id}`: delete.

All requests use the central authenticated client and selected company header. Permissions are `canViewPredefinedRoute`, `canCreatePredefinedRoute`, `canUpdatePredefinedRoute`, and `canDeletePredefinedRoute`, resource `predefined_route`.

Each tenant's `predefined_routes` collection stores normalized mixed `content` in original order and derived read-only `cities`/`zipcodes` arrays. The API ignores caller-supplied derived arrays and recomputes them from content. No browser mock/session store is used.

Pickup search uses the existing nested filter contract, with a server-resolved virtual field:

```json
{
  "operator": "and",
  "filters": [
    { "field": "completed", "operator": "eq", "value": false },
    { "field": "predefinedRoute.id", "operator": "eq", "value": 2 }
  ]
}
```

The API resolves the route from the same tenant and generates `(sender.address.city IN cities OR sender.address.zipcode IN zipcodes)`. These are the pickup's customer sender address snapshots. City and ZIP comparisons use the existing exact case-insensitive query operators. The route condition is ANDed with the advanced-filter expression; existing OR groups remain grouped. Counting, access scope, sorting, and pagination stay in MongoDB. A pickup matching both lists is returned once. Missing/deleted routes fail closed. Empty saved routes match nothing. `neq` uses both negative lists with AND. One lookup is made per distinct referenced route, never per pickup; unfiltered requests do not access the route catalog.

## Rollout and verification

Deploy the API before the portal and run the normal tenant permission/index reconciliation. Seed permission IDs 190–193 are retained under the new names, preserving existing role references. Refresh the session permission cache after seeding. The new catalog uses `predefined_routes`; the former `/legacy-routes` API and browser mock were removed. Existing `legacy_routes` documents are not automatically copied or deleted; any tenant with real records there requires an explicit reviewed migration. Sample browser-only rows are not production data and are not seeded.

Verification includes real form/create interactions and loader layout at mobile/desktop widths, unit contract tests, full portal production build, backend tests and Swagger/Scalar parity, and an isolated MongoDB integration fixture. The database fixture has 1,000 pickups and three mixed city/ZIP matches across two pages, verifies same-ID company isolation, and fails after deleting the route. A sample local run executed 20 filtered count/page calls in 46 ms (fixture evidence, not a production latency guarantee). Compared with the former client expansion, the portal now makes one pickup request instead of a route-detail request followed by a pickup request per filtered page.
