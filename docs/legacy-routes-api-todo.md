# Legacy routes — backend TODO

Portal CRUD + directory search/filters are ready under **Routes → Legacy routes** (`/legacy-routes`). The API does not expose this resource yet.

Until it does, the portal serves in-memory sample data (`src/lib/legacy-routes/api/legacy-routes-mock.ts`) that answers the same requests described below, including `/search` filter bodies. Changes last for the browser session only. Once the endpoints are live, set `NEXT_PUBLIC_LEGACY_ROUTES_MOCK=false` (then remove the mock).

## Model

Suggested `legacy_route` (company-scoped):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | int | PK (keep legacy ids when importing) |
| `name` | string | Required, trimmed |
| `content` | string | Required. Comma-separated city list, e.g. `"Miami, Hialeah, Doral"` |

The portal normalizes `content` before create/update: cities are trimmed, inner whitespace is collapsed, empty entries and case-insensitive duplicates are removed, and the list is joined with `", "`. City order is preserved.

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

## Permissions

The portal currently gates the page with the Routes section permission (`canViewPickup`), the same as route crews and daily routes, because the API has no route permission seed. If dedicated grants are added (e.g. `canListLegacyRoute`, `canCreateLegacyRoute`, `canUpdateLegacyRoute`, `canDeleteLegacyRoute` on resource type `legacy_route`), the API must enforce them; the portal can then switch its gates.

## OpenAPI

Document the model and endpoints in Swagger/OpenAPI so the portal Zod schemas stay aligned.
