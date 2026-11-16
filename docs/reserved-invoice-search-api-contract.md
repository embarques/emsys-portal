# Reserved invoice search — remaining contract gaps

## Response and pagination

`POST /v1/invoices/reserved/search` returns a flat `data` array with page
metadata. The portal now parses that response and uses page pagination; this is
verified live. `GET /v1/invoices/reserved` separately returns a cursor page:

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

- GET cursor advancement across a bounded three-item page has been verified
  without overlapping IDs. `remaining` stayed 36 on both pages in that fixture
  sample; unassigned `userId=0` was empty. Verify broader boundary/count cases.
- Bind cursors to company, filter expression and sort; verify cursor boundaries,
  stable tie handling and cancellation without loading the full pool in memory.
- Keep response failures visible in the Portal; do not silently display
  unfiltered results or filter just one cursor page.

## Sorting and schema documentation

- November 13 GET `number:asc` and `number:desc` now return different bounded
  samples; POST sort-direction checks also pass. Document accepted fields and
  preserve this behavior across cursor pages.
- Verify additional sort fields, sort ties and cursor binding.
- Repeated `createdAt:desc` search returned stable IDs with actual timestamp
  ties in the bounded sample. Concurrent mutations and page-spanning ties remain.
- Document search, timestamp fields, request filters/operators, sorts and
  response pagination in OpenAPI.

## Received-at business field

Confirmed business meaning: `receivedAt` is the nullable RFC 3339 server timestamp
when a device claims/receives the reserved invoice number. It does not mean
physical receipt of an invoice or merchandise. The source sets it for the current
device claim and clears it when the device assignment is removed; generation,
reservation and record creation are not substitutes. No separate physical-receipt
field is requested by this decision. Missing older values stay null/absent.
The source uses the company closeout timezone (default America/New_York) for
date-only comparisons; confirm the served contract and boundary behavior.
The November 13 `receivedAt >= 2026-11-01` probe is accepted. Returned missing
values are null; null eq/gte/lte exclusion, neq inclusion and invalid/impossible
date rejection pass. Non-null timestamp/day-boundary fixtures and deployed
business-timezone behavior remain to be verified. Invalid reservedAt dates also reject.

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
- GET/search deny callers lacking `canViewInvoicePool`, accept the explicit
  grant and deny its removal with the identical Firebase token in the disposable
  actor suite. November 13 generate/assign/return missing-grant and same-token
  grant-removal/restoration checks pass on two newly generated numbers. Return
  invalidates old assignment tokens; both numbers remain unclaimed under userId 0.
  Device claims, other permission combinations and tenant isolation remain separate.
- Verify representative query plans and request/payload budgets.
- The current-user threshold readback now matches the persisted preference.
  Broader multi-user/permission/context behavior remains to be exercised.

See [remaining live findings](backend-gap-verification-2026-11-07.md) and
[backend/API gaps](backend-api-gaps.md).
Latest execution: [November 13 verification](backend-gap-follow-up-2026-11-13.md).
