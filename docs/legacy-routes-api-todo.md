# Legacy routes — backend TODO

Portal CRUD + directory search/filters are ready under **Routes → Legacy routes** (`/legacy-routes`). The API does not expose this resource yet.

Until it does, the portal serves in-memory sample data (`src/lib/legacy-routes/api/legacy-routes-mock.ts`) that answers the same requests described below, including `/search` filter bodies. Changes last for the browser session only. Once the endpoints are live, set `NEXT_PUBLIC_LEGACY_ROUTES_MOCK=false` (then remove the mock).

## Model

Suggested `legacy_route` (company-scoped):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | int | PK, **assigned by the API** on create (never sent by the portal; keep legacy ids when importing) |
| `name` | string | Required, trimmed |
| `content` | string | Required. Comma-separated cities and/or ZIP codes, e.g. `"Miami, 33010, Hialeah"`. Keep ZIPs as strings (leading zeros, e.g. `02119`). |

The portal form edits one city or ZIP per row and builds `content` on create/update: entries are trimmed, inner whitespace is collapsed, blank rows and case-insensitive duplicates are dropped, and the list is joined with `", "`. Entry order is preserved, and entries never contain commas.

`createdAt` / `updatedAt` are accepted on responses but not displayed.

## Endpoints

Base path: `/v1/legacy-routes` (portal `API_ENDPOINTS.LEGACY_ROUTES`). Standard success envelope (`success`, `data`, `page`, `resultsPerPage`, `total`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/legacy-routes?page=&limit=&offset=&sort=name:asc` | Paginated list |
| `POST` | `/legacy-routes/search?page=&limit=&offset=` | Search / filter (same body shape as other catalog `/search` endpoints) |
| `GET` | `/legacy-routes/:id` | Detail |
| `POST` | `/legacy-routes` | Create — body `{ name, content }` |
| `PUT` | `/legacy-routes/:id` | Update — body `{ name, content }` |
| `DELETE` | `/legacy-routes/:id` | Delete |

### Search fields

| Field | Operators | Value type |
| --- | --- | --- |
| `name` | `contains`, `startsWith`, `eq`, `neq` | string |
| `content` | `contains`, `startsWith`, `eq`, `neq` | string (`contains` is used to find routes covering a city) |
| `id` | `eq`, `neq`, `gte`, `lte` | number |

The toolbar search box sends an OR group of `name contains <q>` and `content contains <q>`. Text matching should be case-insensitive.

## Appointments filter

Appointments (`/appointments`) have a **Legacy route** advanced filter (`legacyRoute.id`, Equals / Not equals). Before searching, the portal loads the selected route (`GET /legacy-routes/:id`) and expands it on `POST /pickups/search`:

- Entries matching `^\d{5}(-\d{4})?$` are ZIP codes → `sender.address.zipcode in [...]`.
- Everything else is a city → `sender.address.city in [...]`, sending each city as entered, lower, UPPER and Title Case because pickup `eq`/`in` compare exactly.
- Equals = city **or** ZIP on the route; Not equals = `notIn` on both, joined with AND.

Backend follow-up (preferred): make `in`/`notIn` on `sender.address.city` case-insensitive (collation or a normalized field), or accept `legacyRoute.id` directly on `/pickups/search` and expand it server-side. Either removes the case-variant workaround and the extra route lookup.

## Permissions

The portal currently gates the page with the Routes section permission (`canViewPickup`), the same as route crews and daily routes, because the API has no route permission seed. If dedicated grants are added (e.g. `canListLegacyRoute`, `canCreateLegacyRoute`, `canUpdateLegacyRoute`, `canDeleteLegacyRoute` on resource type `legacy_route`), the API must enforce them; the portal can then switch its gates.

## OpenAPI

Document the model and endpoints in Swagger/OpenAPI so the portal Zod schemas stay aligned.
