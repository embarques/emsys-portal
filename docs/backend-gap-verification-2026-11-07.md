# Backend verification — pending and unverified findings

Open findings from the November 7, 2026 checks against
`https://api.embarqueros.com/v1`, company `64d5c0b0d1eab2aaf30b1819`.

## Pending fixes

| Area | Remaining issue |
| --- | --- |
| Historical reconciliation | PAYMENT searches returned 24,134 rows, but only 3 matched OUTSTANDING and none matched RECONCILED. Verify backfill deployment, ambiguous rows and safe reruns. |
| Route pages | Route Appointments sends `route.id gt ""`, rejected with 400; Route Deliveries filters by route name. Adopt a documented populated-ID predicate and cover unnamed, missing/null/empty IDs and assigned-only users. |
| Reserved search response | POST returns a flat `data` array plus page metadata; the Portal requires `data: { items, remaining, lowThreshold, nextCursor? }`. Align the response and cursor contract. |
| Reserved GET sorting | `sort=number:asc` and `sort=number:desc` returned identical ascending pages. Implement/document GET sort behavior and align it with search. |
| User-specific low-stock threshold | `GET /invoices/reserved?userId=73` returned `lowThreshold: 10` while that requester's preference was 0. Correct per-user threshold handling and add persisted/push warnings. |
| Vehicle compliance coverage | Inspection and registration `lte` filters return 400 field-not-allowed; create/read/update OpenAPI schemas omit the dates. Add indexed due/overdue queries, business-date evaluation and server notifications with complete fleet coverage. |
| Table audit | The checked-in script throws a TypeError on absent `definitions`. Update schema loading for OpenAPI 3/Swagger 2, then resolve `barcode.Barcode` table-field drift for `voidReason`, `voidedAt`, `voidedBy` and run the full audit. |

## Unverified acceptance

- Delivery: unknown/invalid/negative balances, uncleared payments, concurrent
  financial changes, policy/ownership negatives, assigned-only scope and replay.
- Customer deletion: commit-before-history ordering, seeded tenant indexes and
  persisted deletion history. `/user-activities` is not an authoritative history
  endpoint, so its empty search result cannot settle these checks.
- Assigned invoice creation: transaction-time pickup, crew, customer and branch
  validation; branch 11, restricted users, revoked assignments, races, replay and
  initial-payment effects. Contract text alone does not prove these cases.
- Unfinished barcode removal: obtain the backend contract and verify the
  documented movement/removal lifecycle.
- Reservations: stable sort ties, additional sort fields, cursor/filter/company
  binding, permission denial, tenant isolation, date semantics and query budgets.
- Mock artifacts: finish the cleanup/retention work in
  [mock-data follow-up](mock-data-follow-up.md).

See [backend/API gaps](backend-api-gaps.md) and the linked feature documents for
remaining contract and acceptance requirements.
