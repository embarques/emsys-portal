# Reserved invoice advanced search (backend implementation pending)

The Reserved invoices directory now uses the shared column / condition / value
filter builder, including AND/OR joins and the existing saved-filter presets.
This document is the proposed frontend/backend contract, requested on the
assumption that EMSYS API will add support. It does not assert that the endpoint
is deployed. The portal keeps `GET /invoices/reserved` for unfiltered browsing
and the existing number-search bar. Completed advanced filters use the endpoint
below; an unavailable endpoint produces a visible query error, without silently
showing unfiltered results or filtering only one cursor page.

## Request

`POST /v1/invoices/reserved/search?limit=50&after=<optional opaque cursor>`

Use the central Axios authentication and company headers, and the same explicit
invoice-pool view permission and tenant isolation as the existing GET endpoint.
This is a read-only search, not a pool mutation. It must not claim, assign,
generate, consume, return, or otherwise change a reservation.

The JSON body follows the application's shared search tree format:

```json
{
  "operator": "and",
  "filters": [
    {
      "operator": "or",
      "filters": [
        { "field": "allocation.userId", "operator": "eq", "value": 0 },
        { "field": "claimed", "operator": "eq", "value": true }
      ]
    },
    { "field": "number", "operator": "contains", "value": "102" }
  ]
}
```

Allowed leaves:

| Field | JSON value | Operators |
| --- | --- | --- |
| `number` | string | `eq`, `neq`, `contains`, `startsWith` |
| `receivedAt` | date (`YYYY-MM-DD`) or RFC 3339 timestamp string | `eq`, `neq`, `gte`, `lte` |
| `allocation.userId` | integer (zero selects the company pool) | `eq`, `neq` |
| `claimed` | boolean | `eq` |

The portal converts the displayed Status filter into these canonical leaves:

- Available: `claimed = false AND allocation.userId = 0`.
- Assigned, awaiting download: `claimed = false AND allocation.userId != 0`.
- Downloaded to mobile: `claimed = true`.
- Status `neq` negates the entire predicate, including both leaves when present.

The builder combines completed rows left to right: `A OR B AND C` becomes
`(A OR B) AND C`, matching the shared query-logic preview. The search bar is
ANDed with the entire advanced expression as a `number contains` leaf. Blank
rows have no effect. Preserve numeric zero and boolean false as typed values.
Validate fields, operators, values, tenant scope, and bounded expression size on
the server; apply all predicates before cursor pagination.

## Response

Return the existing success envelope and invoice-pool page schema:

```json
{
  "success": true,
  "data": {
    "items": [],
    "remaining": 0,
    "lowThreshold": 10
  }
}
```

Each item retains `id`, `number`, `claimed`, and `allocation: { userId, token }`.
The API is also expected to add `receivedAt`, a nullable RFC 3339 timestamp for
when the invoice was received. This is a separate business field: do not replace
it with generation, assignment, download, or record-creation time. Older records
may omit the field or return null; the portal displays a dash in either case.
The table formats populated values in the configured application timezone.
For advanced filters, a date-only value covers the business calendar day in
that timezone (`eq` / `neq` compare the day; `gte` starts at its beginning and
`lte` includes its end). Timestamp values compare instants. Missing/null values
must not satisfy `eq`, `gte`, or `lte`; `neq` includes them. Validate date inputs
on the server. This addition, including filter support, awaits backend delivery.

Use the existing stable cursor order and optional `nextCursor`. `remaining`
counts matching unused reserved numbers across all pages, including assigned
and downloaded numbers, rather than only the returned page. A cursor belongs to
the same company and filter expression. Honor cancellation and use indexed,
bounded queries rather than loading the entire pool into application memory.

Backend acceptance checks should cover nested AND/OR, negated status, search-bar
intersection, company-pool zero, boolean false, permission denial, tenant
isolation, cursor boundaries, and representative query-plan/request budgets.
