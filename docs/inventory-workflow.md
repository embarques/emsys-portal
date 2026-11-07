# Inventory — remaining gaps

Inventory means internal supplies, not customer merchandise. Wire models and
commands are defined in [api-docs.json](../api-docs.json); business meaning is in
[APP_CONTEXT.md](../APP_CONTEXT.md).

## Backend contract and acceptance

- Verify broader concurrency and injected-failure atomicity across stock,
  dispositions, sales, obligations, payments and journals.
- Decide Debit/Wire support for reconciliation payments. WIRE and DEBIT-CARD
  return 422 unknown accounting payment method; the inventory enum excludes both.
  Journal method support does not establish this separate contract.
- Confirm exact named write capabilities where endpoint descriptions only say
  "documented named capability". Cover denied CRUD fallbacks, responsible-party
  changes, tenant/branch isolation and grant revocation.
- Verify inventory autoReconcile with an accepted create control and the
  standalone reconciliation grant; a generic denied create proves neither.
- Verify historical joint membership, responsible-party changes and permission
  isolation for remaining holder combinations. Align clients
  with `responsibleHolderIds`; one physical batch must remain counted once.
- Verify onboarding warehouse creation, inactive records and partial-update
  false/zero/omitted/null behavior across every relevant resource/client.
- Recheck item unit/currency/price, supplier contact/address and document
  note/line-item search allowlists, inactive filters and typed supplier references.
  Add portal filters only after their server contract is established.
- Verify weighted-average valuation, payment allocation/release, closeout
  variance rules, reopen revisions, audit immutability and duplicate-post prevention
  for remaining lifecycle paths.

- Verify remaining physical-holder transfer combinations, audited administrative
  reassignment and effective-dated crew/custody membership.
- Verify retained stock persists overnight, counts reconcile available and
  quarantined stock, variances are classified before close, and authorized
  reopening creates an immutable new revision rather than rewriting history.

## Portal limitations

- Wire supported edits for custody assignments, item prices and crew members.
- Add sales-report unpaid approval and define a closeout save-progress endpoint
  before offering that action.
- Replace browser-timezone instant assumptions with the agreed company-timezone
  behavior; keep business dates separate from instants.
- Replace comma-separated cash-handover payment IDs with a scoped picker.
- Complete authenticated end-to-end coverage of Supply operations, including
  permission-scoped list/read/write and more records than one lookup page.
- Confirm rollout/grants for `NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED` before
  enabling the workspace for a tenant.

See [backend gaps](backend-api-gaps.md),
[financial controls](financial-controls.md) and
[daily-route accountability](daily-route-accountability.md).
