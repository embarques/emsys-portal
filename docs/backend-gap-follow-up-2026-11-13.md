# Mock-company backend gap verification — November 13, 2026

Company `64d5c0b0d1eab2aaf30b1819`; API `https://api.embarqueros.com/v1`.
This supersedes the corresponding runtime claims in the
[November 12 pass](backend-gap-follow-up-2026-11-12.md). The
[remaining-work index](backend-api-gaps.md) distinguishes confirmed defects,
verified runtime changes and unverified lifecycle/contract boundaries.

Only tagged mock fixtures and temporary identities were mutated. No existing
user's grants or existing financial periods were changed. No backend source,
frontend runtime source, API schema, deployment or feature gate was changed.

## Backend fix recheck

| ID | November 13 outcome |
| --- | --- |
| B05 | Still open: deployed Swagger omits business-date and NOT_REQUIRED and still describes clearance as independent. Loan increase requestId and operation are unpublished. Other operation-specific contracts still need publication. |
| B06 | Runtime 500 fixed: all four paidAmount/balance filter/sort probes now return explicit unsupported-field 400. This does not add field support; publish the exclusions. |
| B07 | Bounded GET number asc/desc now differ; POST sorting and real portal response adapters also pass. Cursor/filter/sort binding and concurrency ties remain V14. |
| B08 | Search route is deployed. All nine requested filter candidates are accepted; returned status/resourceType/action rows match. Empty actor/date results do not prove those predicates' full semantics. |
| B09 | 185 accepted / 57 unsupported across the 242 field/sort probes. Of the 57, four are B06 loan exclusions and 53 remain B09. Twelve formerly unsupported candidates now pass: pickup legacySyncError/legacySyncedAt/completedBy.name filter/sorts and all six assigned-delivery candidates. No HTTP 500 remains in this matrix. |
| B10 | Tested funding-reference paths fixed: nonexistent/wrong-branch BANK create/sync reject, invalid EXPENSE sources reject with a genuine persisted EXPENSE control, spoofed bank metadata is canonicalized, and invalid funding update preserves saved version/account/ledger. Untested account classes/scopes remain V05. |
| B11 | Bounded createdAt-desc journal list returns 200, at most six rows, in descending order. Database plan/load guarantees remain I07. |
| B12 | Router is deployed; the real gated portal adapter now fails required requestId validation. Valid lifecycle remains unverified because an eligible fixture-branch LOAN account/current period could not be established without changing existing business periods. |
| B13 | Ordinary POST through the real portal adapter now succeeds with its documented branch and creates 200 pieces. Unpaid-registration PUT completion was not separately established. |
| B14 | receivedAt is exposed as nullable and supports filtering. Null eq/gte/lte exclusion, neq inclusion and invalid/impossible-date rejection pass. No non-null business-midnight boundary fixture was available. |
| B15 | New confirmed defect: an EXPENSE classification reference can forge persisted ASSET account 5 as Gasolina/EXPENSE; saved ledger uses the supplied classification. Funding-reference fixes do not resolve this separate field. |
| B16 | New confirmed API discrepancy: generated pieces omit ALM-NY; successful versioned embedded status updates send CONDUCE but readbacks still omit status. Route assignment/removal does persist. Backend inspection must distinguish persistence from response-projection defects. |

Read-only evidence: [candidate matrix](backend-gap-readiness-recheck-2026-11-13.json),
[real adapter/published-contract readback](backend-gap-readback-recheck-2026-11-13.json),
[23 contract controls](backend-gap-contract-controls-2026-11-13.json), and
[account/query/requestId controls](backend-gap-controls-2026-11-13.json).

## Section 3 execution and limits

| ID | Established / remaining |
| --- | --- |
| V02 | Independently keyed concurrent commands for the same pending $5 receipt produce one success and one 409; paid/balance change exactly once. Existing same-key, mixed/missing batch and changed-payload controls pass. Injected settlement failure and closed-period transitions remain. |
| V05 | Funding rejection/unchanged update, canonical bank metadata, explicit cash receipt/defaults, and genuine CASH/BANK expense controls pass. B15 classification spoof remains. Inactive/non-posting/cross-company, protected BANK changes, allocation and remaining correction paths are unverified. |
| V06 | Real create produces 200 distinct embedded IDs. Empty, duplicate and 201-ID requests reject and preserve all selected pieces. A valid bulk control is still unavailable: matching saved branch/container and an RD-code control return eligibility 400. Embedded sequences differ from catalog IDs; a bounded 200-row prefix catalog lookup exceeded the 30-second client timeout before any catalog-ID write was attempted. Resolve the exact identity/eligibility contract before claiming missing/foreign/delivered atomicity or replay trip allocation. |
| V07 | Real versioned embedded route assignment and explicit null removal pass; invoice/catalog route state agrees. Saved container/status/delivery fields are preserved on removal, but delivery fields are absent, so this does not establish nonempty delivery-ID preservation. Requested CONDUCE never appears in readback (B16); actual CONDUCE/delivered locks, trip reset and legacy fixture coverage remain. |
| V08 | A private uploaded document blocks current-version invoice deletion with 409; invoice version and document metadata remain intact. Removing the document then deleting the invoice succeeds. Missing/stale invoice versions reject. Full linked financial/history evidence remains unverified. |
| V09 | Real customer create/address-only/conflict adapters pass again; rejected identity edit preserves the customer. Both temporary customers are deleted. Seeded legacy duplicates and linked-history cases remain unavailable through ordinary validated writes. |
| V10 | Ordinary branch DTO create passes. Assigned invoice ownership/customer negatives, unpaid-registration completion, revocation/replay, initial payments, branch 11 and explicit receivedBy variants remain unverified. Pickup controls are not invoice controls. |
| V11 | Completed delivery fixtures, tampered balance/policy/photo ownership, assigned scope and completion races remain unverified. No successful delivery positive control was manufactured from the status/bulk prerequisites. |
| V12 | Fifteen inventory checks pass: two-cost receipts, 20 units/$15 carrying value, unchanged rejected negative count, close/replay, reason-required reopen/reclose and immutable earlier revisions. Fault injection, other dispositions and broader grant/autoReconcile combinations remain. |
| V13 | Manual financial close remains 409. No old period was advanced. STALE_OPEN_CLOSEOUT/LATEST_CLOSED, midnight and cross-period transitions require controlled backend clock/lifecycle fixtures. |
| V14 | View/generate/assign/return grants and same-token revocation pass; exactly two new numbers were generated, assigned to the disposable user and returned to userId 0. Returning invalidates old assignment tokens. GET cursor advance, repeated ties, receivedAt null and invalid-date controls pass. Other tenants/branches, filter-bound cursors, mutation ties and non-null business-day boundaries remain. |
| V15 | Scoped pickup, protected UPDATE approval/replay/rejection/self-approval, pending edit lock, stale source, reviewer revocation, assigned-grant revocation and crew revocation pass. Invoice/journal/label/inventory approval actions, pickup VOID, cross-company isolation and in-flight commit windows remain. |

V03/V04/V16 were already outside the current pending Section 3 table. This pass
does not certify browser-reload recovery, a valid loan increase or historical
PAYMENT status migration: readback still finds 26 classified rows among 24,157
historical PAYMENT rows. New posted/reversed fixture status controls pass.

## Final executed suites

| Suite / evidence | Passed | Failed | Interpretation |
| --- | ---: | ---: | --- |
| [Financial final matrix](section3-matrix-final-evidence-2026-11-13.json) | 103 | 1 | The single failure is B15; all financial posting cleanup checks pass. |
| [Invoice final lifecycle](section3-invoice-final-lifecycle-evidence-2026-11-13.json) | 33 | 2 | Both failures are B16 (default/requested status); route/document/version/cleanup checks pass. |
| [Approval/pool/grant final suite](section3-approval-pool-evidence-2026-11-13.json) | 105 | 0 | Only owned pickup/change-request/pool fixtures were changed. |
| [Inventory lifecycle](section3-inventory-evidence-2026-11-13.json) | 15 | 0 | Tagged stock retained; item/supplier retired. |
| [Customer adapters](section3-customer-loan-evidence-2026-11-13.json) | 8 | 0 | Loan negative-path response separately captured; not valid loan certification. |
| [Read-only contract controls](backend-gap-contract-controls-2026-11-13.json) | 23 | 0 | Includes B06 4xx, B08 field acceptance, B11 ordering and B14 null/date controls. |
| [Reservation readback](section3-reservation-evidence-2026-11-13.json) | 5 | 0 | Cursor/tie sample and receivedAt acceptance. |
| [Adapter/schema/history readback](backend-gap-readback-recheck-2026-11-13.json) | 9 | 4 | Historical statuses plus three stale Swagger checks; loan schema absence is inconclusive. |
| [Independent cleanup readback](backend-gap-cleanup-readback-2026-11-13.json) | 100 | 0 | Reversed journals, deleted ordinary shipment invoices and recorded temporary resources remain in the expected saved states. |

Machine-readable [run summary](backend-gap-results-2026-11-13.json). The separate
[retention readback](backend-gap-retention-readback-2026-11-13.json) adds 12 passing
checks for deleted catalog pieces, retired inventory and returned reservations.

These are assertion counts, not counts of independent business scenarios. The
candidate matrix's 57 unsupported probes are capability findings, not another 57
new regressions. Earlier iterations remain raw evidence and are not combined
with final counts.

Harness corrections and incomplete runs are explicit: the first invoice run
used an invalid container-name convention; the next route request incorrectly
used container.name instead of container.number. Subsequent matched-branch and
RD controls still reject embedded numeric bulk IDs. A setup transport failure
left no saved role for its exact marker; an independent read confirmed that.
The first financial run's reversal succeeded before a readback transport error;
independent readback confirms REVERSED/NOT_REQUIRED. No uncertain mutation was
blindly replayed.

Earlier expense-source tests used a stale hardcoded category label. The final
runner creates a genuine EXPENSE account as its positive control and tests the
old forged ASSET reference separately as B15. Earlier CONDUCE-removal assertions
were too broad because CONDUCE itself never persisted; final checks separate
status failure from passing route removal and synchronization.

Focused ESLint and JavaScript syntax checks pass for the changed runners/helpers.
Documentation references, JSON parsing and the final diff were checked. No
frontend runtime source changed; application build/browser/unit suites were not
rerun or claimed from earlier sessions.

## Retention and prerequisites

Exact retained branch/period, registration and inventory IDs are recorded in
[mock-data follow-up](mock-data-follow-up.md). All ordinary shipment fixtures,
their generated catalog pieces, uploaded private documents, temporary tenant
identities and Firebase identities were removed by the runners. Two unpaid
financial registrations and immutable journal/reversal evidence remain in their
own fixture branches. Independent cleanup verifies the journal/ordinary-invoice
and recorded temporary-resource readbacks; it does not inspect Firebase admin
state or storage objects directly.

No token was written to repository artifacts. No public report was generated,
all mutations targeted the authorized mock company on the live API host, and
no commit/push/deployment occurred.
Fault injection, backend database/history inspection, controllable clocks,
commit-window races and a second authorized tenant remain necessary for their
specific assertions. This is an executed mock-company audit with explicit
remaining work, not a blanket production sign-off.
