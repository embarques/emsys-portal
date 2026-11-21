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
   accountable for **that journal only**. Each daily route has exactly one
   supervisor; the financial form displays that person without a separate choice.
   Ambiguous legacy crews must be corrected before new assignment.
   A different employee must not be sent
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

Invoice merchandise responsibility and the INITIAL-PAYMENT collector are separate.
The collector defaults to the merchandise party when payment assignment is
authorized, and stays independently editable. An explicit collector choice survives
navigation, merchandise changes and lookup refreshes; without an override, the
default follows the merchandise selection before posting.
`canAssignInvoiceResponsibility` on `invoice_responsibility` permits another
employee/route selection; `canAssignPaymentResponsibility` on
`payment_responsibility` controls INITIAL-PAYMENT and later PAYMENT/DISCOUNT/SURCHARGE (and API REFUND).
Route management and employee CRUD are not substitutes. Administrators receive
both through the API seed; existing tenants require additive seeding and session
permission refresh. These changes depend on API PR #388.

Without the relevant grant, the Portal offers the creator-linked employee default
and routes only when an exact active link establishes that the user is supervisor.
It never identifies self by name/email or by scanning a directory page. The API
resolves the default; missing/ambiguous links reject creation. The invoice wizard
uses independent merchandise and collector choices across desktop/mobile.
Completion keeps the registered merchandise party independently of the collector
and locks merchandise responsibility after registration. Later payments never
copy responsibility from the invoice.

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

## API PR #377 review (2026-11-21)

[API PR #377](https://github.com/embarques/emsys-api/pull/377) separates
SURCHARGE/DISCOUNT assignment from invoice receive history, but explicitly tests
that PAYMENT still inherits the invoice route. The confirmed product behavior is
that **all three later transactions are independent**. That PAYMENT test conflicts
with the required behavior and must not be restored during conflict resolution.

The broader fix, [commit 3658380](https://github.com/embarques/emsys-api/commit/36583802e9e4355a22b5b6588f66b2a3563fdd96),
is already in API `dev` (verified against GitHub during this review). PR #377's
original implementation is therefore superseded for route inheritance. This does
not establish that the fix has been deployed or that production data is migrated.

### Expected lifecycle

| Stage | Expected behavior |
| --- | --- |
| Choose an existing invoice | Select its reference and current totals; retain the journal's own assignment. Do not copy invoice `dailyRoute`, `receivedBy`, or merchandise responsibility. |
| Choose an employee | Send that employee with route aliases cleared. Assigning another party requires the specific payment-responsibility grant, separately from journal-create access. |
| Use creator default | Send no fabricated employee or route; the API resolves the authenticated creator's active employee link. Missing or ambiguous linkage is an error. |
| Choose a route | Send the journal's route, independently of the invoice route. The API captures that route's single supervisor. Ambiguous legacy crews need correction before new assignment. |
| Post PAYMENT | Cash applies to invoice payment/balance immediately. Bank receipts defer that application until clearance. Internal reconciliation alone does not settle the bank receipt. |
| Post DISCOUNT | Increase invoice discount and reduce receivable/balance; do not treat it as collected cash. Reject an adjustment that would make the balance negative. |
| Post SURCHARGE | Increase invoice cost, surcharge and receivable/balance; do not treat it as collected cash. |
| Closeout/retry | The server chooses the current authorized closeout. A failed or uncertain request must retain its draft and duplicate-submission protection. |
| Read/edit/reconcile later | Use the journal's recorded employee and route snapshot. Invoice receive history and subsequent crew changes must not silently transfer accountability. Edits/corrections remain subject to server permissions, versions and allowed actions. |

### Confirmed alignment (2026-11-21)

- The portal's journal payload and read/edit adapters already keep later PAYMENT,
  SURCHARGE and DISCOUNT assignments separate from nested invoice history.
  Regression coverage in `tests/unit/daily-route-accountability.test.mjs` now
  checks explicit employee, creator default, and invoice-route read/edit isolation
  for all three types.
- **One supervisor per daily route:** confirmed by the user. Route forms reject
  ambiguous lead roles before POST/PUT; financial assignment excludes ambiguous
  crews and displays the route's sole supervisor. The API vehicle-route service
  already validates exactly one supervisor and driver. Historical journal
  snapshots remain unchanged. Legacy data normalization and deployed enforcement
  remain backend acceptance items.
- **Independent initial collection:** confirmed by the user. Preserve the existing
  separate selectors and defaulting policy described above. Browser regressions
  cover defaulting, explicit override, navigation/refresh retention and the
  restricted-user self default on desktop and mobile.

### Validation limits

Portal unit tests exercise the actual adapters with the central HTTP boundary
replaced. They do not establish backend transaction atomicity, tenant enforcement,
permission seeding, deployed behavior, or authenticated browser acceptance.
Focused API Go tests could not run in this review environment because `go` was
not available on PATH. No live API mutations were performed.

After the confirmed decisions, 112 focused unit tests and eight isolated browser
tests passed, including desktop/mobile assignment controls and initial collector
defaulting and override retention. TypeScript, lint and the production build passed
(existing repository warnings remain). These changes add no API calls or dependencies; route validation
tests assert zero requests for invalid lead-role assignments.

The additional `journal-edit-submission.test.mjs` file could not exercise
its three cases: its existing test loader cannot resolve the workspace's relative
`./journal-correction-dialog` import. Direct-edit submission behavior therefore
remains unverified by that fixture in this review.
