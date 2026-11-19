# Daily-route accountability

## Three distinct route concepts

| Concept | Owner | Branch | Purpose | Financial ownership? |
| --- | --- | --- | --- | --- |
| Invoice **`receivedBy`** | Invoice | **NY** | Who received the merchandise: a **daily route** or a **single employee** | No by itself |
| Invoice **`dailyRoute`** | Invoice snapshot | **NY** | Recordkeeping / insights when receive was via a route (often derived from `receivedBy` when type is route) | **No** for later journals |
| Barcode / label **`route`** | Each merchandise label | **RD** | Delivery daily vehicle-route | No |

`createdBy` remains who digitized the invoice and is never a substitute for Received by.

## Journal accountability (case by case)

1. **INITIAL-PAYMENT** (invoice creation): the assignee chosen on that transaction
   (employee, daily-route supervisor, or creator-linked employee) is financially
   accountable for that initial payment. The invoice may still store NY
   `receivedBy` / `dailyRoute` for history and insights.
2. **Later PAYMENT / SURCHARGE / DISCOUNT**: each journal chooses its own assignee.
   Do **not** inherit `invoice.dailyRoute` for reconciliation ownership.
3. When a journal itself selects a daily route, that route’s **supervisor** is
   accountable for **that journal only**. A different employee must not be sent
   with a conflicting route id (`INVALID_DAILY_ROUTE`).

## API contract notes

- `journal.attributeFinancialRoute` must use only the route selected on the
  journal entry (`dailyRouteId` / `vehicleRoute`). It must not pull
  `invoice.dailyRoute` onto later posts.
- Portal Daily Income Assignment for surcharge/payment/discount is independent
  of the invoice’s NY receive route.
- Barcode route filters and assignment UIs use RD daily routes only.

## Remaining gaps

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
- Pending INITIAL-PAYMENT invoices still map journal `employee` onto
  `receivedBy` in places; confirm that path does not conflate financial assignee
  with NY receive history when both differ.

See [inventory gaps](inventory-workflow.md) and
[backend gaps](backend-api-gaps.md).

## Responsibility grants and creation workflow (2026-11-18)

Invoice responsibility and INITIAL-PAYMENT use the same creation-time party.
`canAssignInvoiceResponsibility` on `invoice_responsibility` permits another
employee/route selection; `canAssignPaymentResponsibility` on
`payment_responsibility` controls later PAYMENT/DISCOUNT/SURCHARGE (and API REFUND).
Route management and employee CRUD are not substitutes. Administrators receive
both through the API seed; existing tenants require additive seeding and session
permission refresh. These changes depend on API PR #388.

Without the relevant grant, the Portal offers the creator-linked employee default
and routes only when an exact active link establishes that the user is supervisor.
It never identifies self by name/email or by scanning a directory page. The API
resolves the default; missing/ambiguous links reject creation. The invoice wizard
uses one responsibility choice across desktop/mobile, then applies the committed
journal party to completion and locks responsibility after registration. Later
payments never copy responsibility from the invoice.

Operators with scoped invoice access use `GET /journals/payment-invoice/lookup?number=<exact-number>` from API
PR #388. This exact, case-sensitive company lookup returns only id/number/current
payment totals and excludes reserved records. It does not expose customer details,
expand invoice browsing, or permit another company's invoices. DISCOUNT/SURCHARGE
continue using ordinary invoice access. Until the endpoint is deployed, a missing
route (404 without the API's invoice-not-found response) uses existing scoped
invoice search and displays an availability notice. Forbidden/error responses
never trigger that fallback. Full database/authenticated acceptance runs after
the API merge/deployment; a Portal dev push does not establish those results.

Users who already have company-wide invoice-view access retain ordinary number/name/phone search. The narrow exact-number endpoint supplements payment access for scoped/no-invoice-view operators.
