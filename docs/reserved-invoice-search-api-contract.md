# Reserved invoice search — remaining contract gaps

## Response and pagination

`POST /v1/invoices/reserved/search` returns a flat `data` array with page
metadata, incompatible with the Portal's cursor-page schema. Align the response
with the required shape:

```json
{
  "success": true,
  "data": {
    "items": [],
    "remaining": 0,
    "lowThreshold": 10,
    "nextCursor": "optional opaque cursor"
  }
}
```

- Define and verify `limit` and `after` behavior. `remaining` must count matching
  unused reservations across all pages, not just the current page.
- Bind cursors to company, filter expression and sort; verify cursor boundaries,
  stable tie handling and cancellation without loading the full pool in memory.
- Keep response failures visible in the Portal; do not silently display
  unfiltered results or filter just one cursor page.

## Sorting and schema documentation

- Correct GET sort handling: `number:asc` and `number:desc` returned identical
  ascending pages. Align GET/search ordering and document the accepted fields.
- Verify additional sort fields, sort ties and cursor binding.
- Document search, timestamp fields, request filters/operators, sorts and
  response pagination in OpenAPI.

## Received-at business field

Add/document `receivedAt` as a nullable RFC 3339 timestamp for when the invoice
was received. It is distinct from `reservedAt`, generation, assignment, download
and record creation. Define the authoritative application/business timezone;
older missing values must remain null/absent rather than use another timestamp.

Verify these `receivedAt` filter semantics:

- `eq` / `neq` with a date-only value compare the business calendar day.
- `gte` starts at the beginning of that day; `lte` includes its end.
- Timestamp values compare instants.
- Missing/null values do not satisfy `eq`, `gte` or `lte`; `neq` includes them.
- Invalid date inputs are rejected.

## Remaining acceptance

- Verify all documented field/operator combinations and reserved timestamp date
  boundaries; a successful sample does not establish complete operator coverage.
- Cover negated multi-leaf status predicates, search-bar intersection and
  left-to-right mixed AND/OR expressions with cursor pagination.
- Verify invoice-pool view permission, denied callers, company/tenant isolation,
  bounded expression size and cancellation. Searches must never mutate a pool.
- Verify representative query plans and request/payload budgets.
- Correct the user-specific threshold mismatch: `userId=73` returned 10 while
  the requester's configured threshold was 0.

See [remaining live findings](backend-gap-verification-2026-11-07.md) and
[backend/API gaps](backend-api-gaps.md).
