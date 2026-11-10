# Daily-route accountability — remaining gaps

## Route-page integration and contract gaps

- Replace the rejected `route.id gt ""` comparison in Route Appointments
  (HTTP 400) and the route-name comparison in Route Deliveries with a documented
  populated-ID predicate. Verify unnamed routes, missing/null/empty IDs, and
  assigned-only users; these edge cases lack fixture coverage.
- Define and verify invoice-embedded unfinished-barcode removal, mirror
  synchronization and numeric delivery/trip/history effects. See the
  [pending assignment contract](daily-route-assignment-api-contract.md).

## Remaining acceptance

- Complete the [assignment acceptance matrix](daily-route-assignment-api-contract.md):
  invoice-embedded removal/movement, server business-midnight rollover, invoice
  bulk atomicity, foreign-tenant batches, scoped delivery/invoice actors, actual delivery
  completion races and legacy-enabled pickup completion.
- Fix pickup role-change enforcement and verify concurrent membership/permission
  revocation at commit; see the [authorization gaps](daily-route-assignment-api-contract.md).
- Verify legacy appointment/invoice/journal snapshot coverage, immutability after
  route edits and consistent schemas on list/detail/search and analytics.
- Verify historical joint membership, remaining allowed holder combinations,
  responsible-party changes, scoped access and client/ledger/queue alignment.
- Verify supervisor financial accountability independently of route attribution
  and inventory holders, including changed supervisor/assignment and historical
  reconciliation/reporting.
- Verify `dailyRoute` and supervisor fields survive scoped filtering and any
  employee/branch/method aggregation; define unsupported aggregation explicitly.
- Complete the scoped approval/controlled-correction matrix in
  [financial-controls.md](financial-controls.md).

See [inventory gaps](inventory-workflow.md) and
[backend gaps](backend-api-gaps.md).
