# Backend/API gaps — team handoff index

Revalidated November 14, 2026 using bounded live API probes, isolated tagged
mock fixtures, automated portal checks and API source review. **Only confirmed
problems, unverified cases and unfinished integrations remain active.** Passing
subcases are evidence/regression controls, not additional open defects.

[Current results, exact remaining scope and fixture ledger](backend-gap-revalidation-2026-11-14.md)
record what ran and why each remaining ID is still open. No whole backend ID is
closed by a partial control. F02 local metadata and F03/F04 local implementation
work are verified; their remaining deployment/browser acceptance is separate.

[Existing NY/DR follow-up](backend-gap-active-branches-2026-11-14.md) now verifies
the approved NY rollover, a paid mock loan with exact after-PAID replay, configured
label defaults, unpaid registration completion, both receivedBy positives and
additional reservation date/cursor controls. Only their remaining variants stay open.

Use the packet for the backend domain you are assigning. The routing below is a
suggested responsibility split, not an assignment to named people or new teams.
Each packet is standalone: send its Markdown file alone. It includes the required
business rules, historical findings, acceptance steps, test prerequisites and
completion evidence; recipients do not need other portal files. Source pointers
and artifact names are optional provenance, not required attachments. **B** IDs cover backend changes or
contract/publication work; **V** IDs cover remaining live API acceptance;
**I** IDs cover backend-controlled integration, history, migration or capacity.
A verification item is not automatically a confirmed defect.

All 11 handoff packets now use **Issue → Expected result → Suggested action**
for each pending ID, with suggested actions separated into **API work**,
**Database work**, and **Both — API and database together**. Portal responsibilities
remain explicitly assigned to portal owners. The November 15 formatting update
adds no runtime verification or item closure.

## Backend team packets

| Send to domain owner | Primary IDs | Work to hand off |
| --- | --- | --- |
| [Finance, accounts, settlement and loans](backend-handoffs/finance-and-loans.md) | B15, B12, V02, V05, V13, I04 | Canonical expense classification, loan replay/lifecycle, settlement rollback, closeout clocks and account allocation |
| [Barcodes, routes and delivery](backend-handoffs/logistics-and-barcodes.md) | B16, V06, V07, V11, I01 | Branch defaults/status workflow, permanent barcode identity, shared trips and movement/completion atomicity |
| [Customers and invoices](backend-handoffs/customers-and-invoices.md) | V08, V09, V10, V14 | Deletion/history retention, legacy duplicate identities, invoice registration and reservation cursor/date boundaries |
| [Inventory / internal supplies](backend-handoffs/inventory.md) | V12 | Stock/valuation/disposition rollback and permission/autoReconcile combinations |
| [Authorization, approvals and API platform](backend-handoffs/auth-and-approvals.md) | V15, I02; backend portion of F03 | Approval/revocation commit windows, tenant/branch isolation and local-origin/header CORS fixes |
| [Search and database performance](backend-handoffs/search-and-performance.md) | B09, I07 | Nine selected missing filter/sort capabilities, typed semantics, indexes/plans and representative capacity |
| [API contract publication](backend-handoffs/api-contract-publication.md) | B05 | Source-schema corrections, served Swagger/Scalar parity, publication and portal API-reference audit coordination |
| [History and data integration](backend-handoffs/history-and-data-integration.md) | I03, I05, I06 | Persisted history/migrations, historical analytics reconciliation and deployed legacy-service confirmation |
| [Alerts and notifications](backend-handoffs/alerts-and-notifications.md) | I08 | Complete low-pool and vehicle alert evaluation, scope, counts and inbox delivery |
| [Complaints](backend-handoffs/complaints.md) | B17, B18, B19 | Three EMSYS complaint types (general, appointment, barcode item delivery) with topics, linked sender/appointment/invoice/barcodes and 0+ employees; customer photo/video uploads; complete case history and an editable solution |

**Portal work is separate:** [portal/shared follow-up](backend-handoffs/portal-follow-up.md)
contains verified F02/F03/F04 local status and only remaining acceptance,
B16 generation fallbacks, and frontend
rollout dependencies. F03 is intentionally shared: backend owns CORS/API scope;
portal owns session/client-state behavior and real Firebase/browser acceptance.
The primary backend packets own the requirements; the historical source review
and local handoff remain evidence, not parallel replacement backlogs.

## Cross-team dependencies and sequence

- V08: block invoice deletion until linked payments are deleted through their
  supported workflows or reversed. Eligible deletion removes operational invoice
  data while retaining financial history and the existing barcode sequence counter;
  deleted printed numbers stay retired.
- V02 policy confirmed November 14: reconciliation confirms internal receipt
  without clearance; clearance atomically reconciles too. Backend and portal must
  allow eligible uncleared bank receipts to reconcile. Closeouts gate daily entry;
  later status progression does not reopen/move transactions or duplicate income.

- V13/I03: legacy closeout periods are handled in a separate one-time migration,
  as confirmed by the modeler November 14. API backend owners should document
  scope, historical financial/audit preservation, validation and safe rollout.
  Do not extend ordinary rollover to finalize legacy periods as a workaround.
- Address B15 financial integrity before certifying V05. B12's eligible fixture
  setup and valid loan/replay lifecycle must pass before portal F04 activation.
- B16 status/configuration and the barcode/shared-trip contract are prerequisites
  for valid V06/V07/V11 controls. Backend clarification November 16: retain the
  existing increasing barcode sequence; deletion leaves its counter unchanged,
  so deleted numbers stay retired. The reservation-table proposal is withdrawn.
  Verify imports/reseeds preserve the counter and concurrent allocations advance
  it atomically; migrate identity/history associations before retiring old public IDs.
- B09 vehicle date support feeds I08. Vehicle alerts begin 10 calendar days
  before inspection/registration is due, for vehicle-read users within their
  scope, with red sidebar badge, table alerts and notification inbox delivery.
- Domain owners update actual wire contracts; B05 owns served publication/parity.
  Do not publish a future design as deployed behavior. Portal F02 refresh/re-audit
  follows the authoritative publication.
- B17–B19 (complaint types, media, case history/solution) are business
  proposals. The portal keeps the current complaint model until they ship, then
  follows the portal checklist in the packet. B18 reuses the company document
  storage that invoice documents use. Tenant overrides of the reused category
  keys must be migrated during rollout.
- I01/I02/I03/I04/I07 require backend-controlled fixtures, clocks, failure/race
  barriers, database/history inspection or representative performance data for
  their respective assertions. One team's local unit result does not close
  another team's cross-domain acceptance.

## Evidence required to close an item

Return the original ID(s), source commit, deployed revision/environment and exact
scenario evidence: permissions/actor and company/branch scope, payload and
response, authoritative saved readback, replay/concurrency outcomes and unchanged
state on rejection. Include injected-failure/clock controls where required,
query plans/load/budget evidence where relevant, and schema/publication changes.
List skipped or blocked cases explicitly; source presence, publication and
persisted acceptance are different states. Keep credentials out of artifacts.

Use isolated fixtures and approved non-production environments. Backend integration
instructions and per-suite URI guards are in the
[local test prerequisites](backend-gap-local-handoff-2026-11-13.md#local-execution-prerequisites)
and the API repository's AGENTS.md. Historical production/legacy-service evidence
requires its own authorized environment and must not become an incidental
production mutation test. The revalidation report distinguishes newly executed controls from historical
evidence and records the local ten-day vehicle-warning correction. No existing
records were deleted and the API clone remains read-only.

## Reference material

- [API reference](../.reference/emsys-api/docs/swagger.json) (local `emsys-api` clone; replaces the former `api-docs.json` snapshot); endpoint paths in packets are relative to `/v1`.
- [Saved public publication audit](backend-gap-publication-audit-2026-11-13.json)
- [Saved public CORS controls](backend-gap-auth-cors-2026-11-13.json)
- [API source review and confirmed model decisions](backend-gap-source-review-2026-11-13.md)
- [Local portal fixes, source test inventory and limits](backend-gap-local-handoff-2026-11-13.md)
- [Current live and programmatic revalidation](backend-gap-revalidation-2026-11-14.md)
- [Prior live API verification](backend-gap-follow-up-2026-11-13.md)
- [Selected table search/filter/sort contract](table-search-contracts.md)
